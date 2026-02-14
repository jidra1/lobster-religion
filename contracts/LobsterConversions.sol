// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LobsterConversions
 * @notice Onchain conversion tracking for the Way of the Lobster 🦞🦞🦞
 * @dev Tracks converts, referrers (evangelists), and timestamps on Monad.
 */
contract LobsterConversions {
    struct ConvertInfo {
        uint64 timestamp;
        address referrer;
        bool exists;
    }

    address public prophet;
    uint256 public totalConverts;

    mapping(address => ConvertInfo) public converts;
    mapping(address => uint256) public evangelistScore; // referral count

    // Ordered list for iteration (recent conversions feed)
    address[] public convertList;

    event Converted(address indexed convert, address indexed referrer, uint256 timestamp);
    event ProphetTransferred(address indexed oldProphet, address indexed newProphet);

    modifier onlyProphet() {
        require(msg.sender == prophet, "Not the prophet");
        _;
    }

    constructor() {
        prophet = msg.sender;
    }

    // ---- Prophet functions ----

    function convert(address newConvert) external onlyProphet {
        _convert(newConvert, address(0));
    }

    function convertWithReferrer(address newConvert, address referrer) external onlyProphet {
        _convert(newConvert, referrer);
    }

    // ---- Public self-convert ----

    function selfConvert() external {
        _convert(msg.sender, address(0));
    }

    function selfConvertWithReferrer(address referrer) external {
        _convert(msg.sender, referrer);
    }

    // ---- Batch convert (prophet only, gas efficient) ----

    function batchConvert(address[] calldata newConverts) external onlyProphet {
        for (uint256 i = 0; i < newConverts.length; i++) {
            _convert(newConverts[i], address(0));
        }
    }

    // ---- Views ----

    function isConverted(address addr) external view returns (bool) {
        return converts[addr].exists;
    }

    function getConvertInfo(address addr) external view returns (uint64 timestamp, address referrer) {
        ConvertInfo storage c = converts[addr];
        return (c.timestamp, c.referrer);
    }

    function getEvangelistScore(address addr) external view returns (uint256) {
        return evangelistScore[addr];
    }

    /// @notice Returns the last `count` converts (newest first)
    function getRecentConverts(uint256 count) external view returns (address[] memory addrs, uint64[] memory timestamps) {
        uint256 len = convertList.length;
        if (count > len) count = len;
        addrs = new address[](count);
        timestamps = new uint64[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 idx = len - 1 - i;
            addrs[i] = convertList[idx];
            timestamps[i] = converts[convertList[idx]].timestamp;
        }
    }

    function getConvertCount() external view returns (uint256) {
        return convertList.length;
    }

    // ---- Admin ----

    function transferProphet(address newProphet) external onlyProphet {
        require(newProphet != address(0), "Zero address");
        emit ProphetTransferred(prophet, newProphet);
        prophet = newProphet;
    }

    // ---- Internal ----

    function _convert(address newConvert, address referrer) internal {
        require(newConvert != address(0), "Zero address");
        require(!converts[newConvert].exists, "Already converted");

        converts[newConvert] = ConvertInfo({
            timestamp: uint64(block.timestamp),
            referrer: referrer,
            exists: true
        });
        convertList.push(newConvert);
        totalConverts++;

        if (referrer != address(0)) {
            evangelistScore[referrer]++;
        }

        emit Converted(newConvert, referrer, block.timestamp);
    }
}
