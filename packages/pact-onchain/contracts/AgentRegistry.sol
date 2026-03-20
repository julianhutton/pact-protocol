// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentRegistry {
    struct Agent {
        string agentId;
        string name;
        string description;
        address owner;
        uint256 registeredAt;
    }

    mapping(string => Agent) private agents;
    mapping(string => bool) private registered;
    uint256 public agentCount;

    event AgentRegistered(
        string agentId,
        address indexed owner,
        string name
    );

    function registerAgent(
        string calldata agentId,
        string calldata name,
        string calldata description
    ) external {
        require(!registered[agentId], "Agent already registered");

        agents[agentId] = Agent({
            agentId: agentId,
            name: name,
            description: description,
            owner: msg.sender,
            registeredAt: block.timestamp
        });

        registered[agentId] = true;
        agentCount++;

        emit AgentRegistered(agentId, msg.sender, name);
    }

    function getAgent(string calldata agentId) external view returns (Agent memory) {
        require(registered[agentId], "Agent not registered");
        return agents[agentId];
    }

    function isRegistered(string calldata agentId) external view returns (bool) {
        return registered[agentId];
    }

    function getAgentCount() external view returns (uint256) {
        return agentCount;
    }
}
