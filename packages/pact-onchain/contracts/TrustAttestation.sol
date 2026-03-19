// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TrustAttestation {
    struct Attestation {
        string agentId;
        string decisionId;
        string action;
        uint256 trustScore;
        uint256 timestamp;
        address attester;
    }

    Attestation[] public attestations;
    mapping(string => uint256) public latestTrustScore;

    event AttestationRecorded(
        uint256 indexed index,
        string agentId,
        string decisionId,
        string action,
        uint256 trustScore,
        address attester
    );

    function recordAttestation(
        string calldata agentId,
        string calldata decisionId,
        string calldata action,
        uint256 trustScore
    ) external {
        attestations.push(Attestation({
            agentId: agentId,
            decisionId: decisionId,
            action: action,
            trustScore: trustScore,
            timestamp: block.timestamp,
            attester: msg.sender
        }));

        latestTrustScore[agentId] = trustScore;

        emit AttestationRecorded(
            attestations.length - 1,
            agentId,
            decisionId,
            action,
            trustScore,
            msg.sender
        );
    }

    function getTrustScore(string calldata agentId) external view returns (uint256) {
        return latestTrustScore[agentId];
    }

    function getAttestations(string calldata agentId) external view returns (Attestation[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < attestations.length; i++) {
            if (keccak256(bytes(attestations[i].agentId)) == keccak256(bytes(agentId))) {
                count++;
            }
        }

        Attestation[] memory result = new Attestation[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < attestations.length; i++) {
            if (keccak256(bytes(attestations[i].agentId)) == keccak256(bytes(agentId))) {
                result[j] = attestations[i];
                j++;
            }
        }
        return result;
    }

    function verifyTrust(string calldata agentId, uint256 minScore) external view returns (bool) {
        return latestTrustScore[agentId] >= minScore;
    }

    function getAttestationCount() external view returns (uint256) {
        return attestations.length;
    }
}
