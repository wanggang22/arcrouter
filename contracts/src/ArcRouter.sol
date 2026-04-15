// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title ArcRouter - ERC-8183 Agentic Commerce Protocol implementation for AI API routing
/// @notice Job escrow for AI inference: client funds USDC → provider returns result → evaluator releases payment
/// @dev Native USDC on Arc (msg.value, 18 decimals). Single-token, single-evaluator design.
///      Compatible with ERC-8183 (Agentic Commerce) + extensible via hooks for ERC-8004 reputation.

interface IACPHook {
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}

contract ArcRouter {
    enum JobStatus { Open, Funded, Submitted, Completed, Rejected, Expired }

    struct Job {
        uint256 id;
        address client;
        address provider;
        address evaluator;
        string description;
        uint256 budget;
        uint256 expiredAt;
        JobStatus status;
        address hook;
        bytes32 deliverable;
    }

    uint256 public jobCount;
    mapping(uint256 => Job) public jobs;
    mapping(address => uint256[]) public clientJobs;
    mapping(address => uint256[]) public providerJobs;

    /// @dev Optional protocol fee (basis points). Owner-controlled. Charged on Completed payouts only.
    address public owner;
    uint256 public protocolFeeBps; // e.g., 50 = 0.5%
    uint256 public protocolBalance;

    // ─── ERC-8183 events ───────────────────────────────────────────
    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed provider,
        address evaluator,
        uint256 expiredAt,
        address hook
    );
    event ProviderSet(uint256 indexed jobId, address indexed provider);
    event BudgetSet(uint256 indexed jobId, uint256 amount);
    event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount);
    event JobSubmitted(uint256 indexed jobId, address indexed provider, bytes32 deliverable);
    event JobCompleted(uint256 indexed jobId, address indexed evaluator, bytes32 reason);
    event JobRejected(uint256 indexed jobId, address indexed rejector, bytes32 reason);
    event JobExpired(uint256 indexed jobId);
    event PaymentReleased(uint256 indexed jobId, address indexed provider, uint256 amount);
    event Refunded(uint256 indexed jobId, address indexed client, uint256 amount);

    // ─── Errors ────────────────────────────────────────────────────
    error NotClient();
    error NotProvider();
    error NotEvaluator();
    error InvalidStatus();
    error EvaluatorRequired();
    error ExpirationInPast();
    error WrongPaymentAmount();
    error JobNotExpired();
    error TransferFailed();

    constructor(uint256 _protocolFeeBps) {
        owner = msg.sender;
        protocolFeeBps = _protocolFeeBps;
    }

    // ─── Core ERC-8183 functions ──────────────────────────────────

    /// @notice Create a job. Status: Open.
    /// @param provider may be address(0) (set later)
    /// @param evaluator required, non-zero (often == client for AI inference jobs)
    /// @param expiredAt unix timestamp, must be future
    /// @param description free-form (model, prompt hash, etc.)
    /// @param hook optional IACPHook
    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        address hook
    ) external returns (uint256 jobId) {
        if (evaluator == address(0)) revert EvaluatorRequired();
        if (expiredAt <= block.timestamp) revert ExpirationInPast();

        jobId = jobCount++;
        jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            description: description,
            budget: 0,
            expiredAt: expiredAt,
            status: JobStatus.Open,
            hook: hook,
            deliverable: bytes32(0)
        });
        clientJobs[msg.sender].push(jobId);
        if (provider != address(0)) providerJobs[provider].push(jobId);

        emit JobCreated(jobId, msg.sender, provider, evaluator, expiredAt, hook);
    }

    /// @notice Set/replace provider while Open. Either client or current provider can call.
    function setProvider(uint256 jobId, address provider_) external {
        Job storage j = jobs[jobId];
        if (j.status != JobStatus.Open) revert InvalidStatus();
        if (msg.sender != j.client && msg.sender != j.provider) revert NotClient();

        bytes memory data = abi.encode(provider_, "");
        _beforeHook(j, this.setProvider.selector, data);
        j.provider = provider_;
        providerJobs[provider_].push(jobId);
        emit ProviderSet(jobId, provider_);
        _afterHook(j, this.setProvider.selector, data);
    }

    /// @notice Set budget while Open. Either client or provider can propose.
    function setBudget(uint256 jobId, uint256 amount, bytes calldata optParams) external {
        Job storage j = jobs[jobId];
        if (j.status != JobStatus.Open) revert InvalidStatus();
        if (msg.sender != j.client && msg.sender != j.provider) revert NotClient();

        bytes memory data = abi.encode(amount, optParams);
        _beforeHook(j, this.setBudget.selector, data);
        j.budget = amount;
        emit BudgetSet(jobId, amount);
        _afterHook(j, this.setBudget.selector, data);
    }

    /// @notice Fund job with native USDC. Open → Funded.
    /// @dev msg.value must equal budget exactly.
    function fund(uint256 jobId, bytes calldata optParams) external payable {
        Job storage j = jobs[jobId];
        if (j.status != JobStatus.Open) revert InvalidStatus();
        if (msg.sender != j.client) revert NotClient();
        if (msg.value != j.budget) revert WrongPaymentAmount();

        bytes memory data = optParams;
        _beforeHook(j, this.fund.selector, data);
        j.status = JobStatus.Funded;
        emit JobFunded(jobId, msg.sender, msg.value);
        _afterHook(j, this.fund.selector, data);
    }

    /// @notice Provider submits work. Funded → Submitted.
    /// @param deliverable keccak256/CID of result (e.g., IPFS hash of LLM response)
    function submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams) external {
        Job storage j = jobs[jobId];
        if (j.status != JobStatus.Funded) revert InvalidStatus();
        if (msg.sender != j.provider) revert NotProvider();

        bytes memory data = abi.encode(deliverable, optParams);
        _beforeHook(j, this.submit.selector, data);
        j.deliverable = deliverable;
        j.status = JobStatus.Submitted;
        emit JobSubmitted(jobId, msg.sender, deliverable);
        _afterHook(j, this.submit.selector, data);
    }

    /// @notice Evaluator approves. Submitted → Completed. Pays provider (minus fee).
    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external {
        Job storage j = jobs[jobId];
        if (j.status != JobStatus.Submitted) revert InvalidStatus();
        if (msg.sender != j.evaluator) revert NotEvaluator();

        bytes memory data = abi.encode(reason, optParams);
        _beforeHook(j, this.complete.selector, data);

        j.status = JobStatus.Completed;
        emit JobCompleted(jobId, msg.sender, reason);

        uint256 fee = (j.budget * protocolFeeBps) / 10000;
        uint256 payout = j.budget - fee;
        protocolBalance += fee;

        (bool ok,) = j.provider.call{value: payout}("");
        if (!ok) revert TransferFailed();
        emit PaymentReleased(jobId, j.provider, payout);

        _afterHook(j, this.complete.selector, data);
    }

    /// @notice Reject. Funded or Submitted → Rejected. Refund client.
    /// @dev When Funded: only evaluator can reject. When Submitted: only evaluator.
    ///      When Open: client can reject (no funds to return).
    function reject(uint256 jobId, bytes32 reason, bytes calldata optParams) external {
        Job storage j = jobs[jobId];
        bytes memory data = abi.encode(reason, optParams);

        if (j.status == JobStatus.Open) {
            if (msg.sender != j.client) revert NotClient();
            _beforeHook(j, this.reject.selector, data);
            j.status = JobStatus.Rejected;
            emit JobRejected(jobId, msg.sender, reason);
            _afterHook(j, this.reject.selector, data);
            return;
        }
        if (j.status != JobStatus.Funded && j.status != JobStatus.Submitted) revert InvalidStatus();
        if (msg.sender != j.evaluator) revert NotEvaluator();

        _beforeHook(j, this.reject.selector, data);
        j.status = JobStatus.Rejected;
        emit JobRejected(jobId, msg.sender, reason);

        uint256 refund = j.budget;
        if (refund > 0) {
            (bool ok,) = j.client.call{value: refund}("");
            if (!ok) revert TransferFailed();
            emit Refunded(jobId, j.client, refund);
        }

        _afterHook(j, this.reject.selector, data);
    }

    /// @notice Permissionless: anyone can trigger refund after expiredAt.
    /// @dev Not hookable per ERC-8183 (anti-block guarantee).
    function claimRefund(uint256 jobId) external {
        Job storage j = jobs[jobId];
        if (block.timestamp < j.expiredAt) revert JobNotExpired();
        if (j.status != JobStatus.Funded && j.status != JobStatus.Submitted) revert InvalidStatus();

        j.status = JobStatus.Expired;
        emit JobExpired(jobId);

        uint256 refund = j.budget;
        if (refund > 0) {
            (bool ok,) = j.client.call{value: refund}("");
            if (!ok) revert TransferFailed();
            emit Refunded(jobId, j.client, refund);
        }
    }

    // ─── Views ────────────────────────────────────────────────────

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function getClientJobs(address c) external view returns (uint256[] memory) {
        return clientJobs[c];
    }

    function getProviderJobs(address p) external view returns (uint256[] memory) {
        return providerJobs[p];
    }

    // ─── Owner ────────────────────────────────────────────────────

    function setProtocolFee(uint256 bps) external {
        require(msg.sender == owner, "owner");
        require(bps <= 1000, "max 10%");
        protocolFeeBps = bps;
    }

    function withdrawProtocolFees() external {
        require(msg.sender == owner, "owner");
        uint256 amt = protocolBalance;
        protocolBalance = 0;
        (bool ok,) = owner.call{value: amt}("");
        if (!ok) revert TransferFailed();
    }

    // ─── Hook helpers ─────────────────────────────────────────────

    function _beforeHook(Job storage j, bytes4 selector, bytes memory data) internal {
        if (j.hook != address(0)) IACPHook(j.hook).beforeAction(j.id, selector, data);
    }
    function _afterHook(Job storage j, bytes4 selector, bytes memory data) internal {
        if (j.hook != address(0)) IACPHook(j.hook).afterAction(j.id, selector, data);
    }
}
