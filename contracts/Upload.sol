// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Upload {

    struct Access {
        address user;
        bool access;
    }

    mapping(address => string[]) private value;
    mapping(address => mapping(address => bool)) public ownership;
    mapping(address => Access[]) private accessList;
    mapping(address => mapping(address => bool)) private previousData;

    function add(string memory url) external {
        value[msg.sender].push(url);
    }

    function allow(address user) external {
        ownership[msg.sender][user] = true;

        if (previousData[msg.sender][user]) {
            for (uint i = 0; i < accessList[msg.sender].length; i++) {
                if (accessList[msg.sender][i].user == user) {
                    accessList[msg.sender][i].access = true;
                }
            }
        } else {
            accessList[msg.sender].push(Access(user, true));
            previousData[msg.sender][user] = true;
        }
    }

    function disallow(address user) external {
        ownership[msg.sender][user] = false;

        for (uint i = 0; i < accessList[msg.sender].length; i++) {
            if (accessList[msg.sender][i].user == user) {
                accessList[msg.sender][i].access = false;
            }
        }
    }

    function display(address _user) external view returns (string[] memory) {
        require(
            _user == msg.sender || ownership[_user][msg.sender],
            "You don't have access"
        );

        return value[_user];
    }

    function shareAccess() external view returns (Access[] memory) {
        return accessList[msg.sender];
    }
}