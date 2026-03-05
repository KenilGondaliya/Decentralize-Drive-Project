// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Upload {
    struct File {
        string url;
        string name;
        string fileType;
        uint256 timestamp;
        uint256 size;
        bool isDeleted;
    }
    
    struct Access {
        address user;
        bool access;
        uint256 grantedAt;
    }
    
    struct SharedFile {
        address owner;
        uint256 fileId;
        string url;
        string name;
        string fileType;
        uint256 timestamp;
    }

    mapping(address => File[]) private userFiles;
    mapping(address => mapping(address => bool)) public hasAccess;
    mapping(address => Access[]) private accessList;
    mapping(address => mapping(address => bool)) private accessHistory;
    
    mapping(address => SharedFile[]) private sharedWithMe;
    
    event FileAdded(address indexed user, uint256 fileId, string name, uint256 timestamp);
    event FileRemoved(address indexed user, uint256 fileId);
    event AccessGranted(address indexed owner, address indexed user, uint256 timestamp);
    event AccessRevoked(address indexed owner, address indexed user, uint256 timestamp);
    event FileShared(address indexed owner, address indexed user, uint256 fileId);

    function addFile(string memory url, string memory name, string memory fileType, uint256 size) external {
        userFiles[msg.sender].push(File({
            url: url,
            name: name,
            fileType: fileType,
            timestamp: block.timestamp,
            size: size,
            isDeleted: false
        }));
        
        emit FileAdded(msg.sender, userFiles[msg.sender].length - 1, name, block.timestamp);
    }

    function getFiles(address _user) external view returns (File[] memory) {
        require(
            _user == msg.sender || hasAccess[_user][msg.sender],
            "You don't have access to these files"
        );
        return userFiles[_user];
    }

    function getFile(address _user, uint256 _fileId) external view returns (File memory) {
        require(
            _user == msg.sender || hasAccess[_user][msg.sender],
            "You don't have access to this file"
        );
        require(_fileId < userFiles[_user].length, "File does not exist");
        require(!userFiles[_user][_fileId].isDeleted, "File has been deleted");
        
        return userFiles[_user][_fileId];
    }

    function updateFile(uint256 _fileId, string memory _newUrl, string memory _newName) external {
        require(_fileId < userFiles[msg.sender].length, "File does not exist");
        require(!userFiles[msg.sender][_fileId].isDeleted, "File has been deleted");
        
        userFiles[msg.sender][_fileId].url = _newUrl;
        userFiles[msg.sender][_fileId].name = _newName;
        userFiles[msg.sender][_fileId].timestamp = block.timestamp;
    }

    function removeFile(uint256 _fileId) external {
        require(_fileId < userFiles[msg.sender].length, "File does not exist");
        require(!userFiles[msg.sender][_fileId].isDeleted, "File already deleted");
        
        userFiles[msg.sender][_fileId].isDeleted = true;
        emit FileRemoved(msg.sender, _fileId);
    }

    function grantAccess(address _user) external {
        require(_user != address(0), "Invalid address");
        require(_user != msg.sender, "Cannot grant access to yourself");
        
        hasAccess[msg.sender][_user] = true;
        
        if (accessHistory[msg.sender][_user]) {
           
            for (uint i = 0; i < accessList[msg.sender].length; i++) {
                if (accessList[msg.sender][i].user == _user) {
                    accessList[msg.sender][i].access = true;
                    accessList[msg.sender][i].grantedAt = block.timestamp;
                    break;
                }
            }
        } else {
           
            accessList[msg.sender].push(Access({
                user: _user,
                access: true,
                grantedAt: block.timestamp
            }));
            accessHistory[msg.sender][_user] = true;
        }
        
        emit AccessGranted(msg.sender, _user, block.timestamp);
    }

    function revokeAccess(address _user) external {
        require(hasAccess[msg.sender][_user], "User doesn't have access");
        
        hasAccess[msg.sender][_user] = false;
        
        for (uint i = 0; i < accessList[msg.sender].length; i++) {
            if (accessList[msg.sender][i].user == _user) {
                accessList[msg.sender][i].access = false;
                break;
            }
        }
        
        emit AccessRevoked(msg.sender, _user, block.timestamp);
    }

    function getAccessList() external view returns (Access[] memory) {
        return accessList[msg.sender];
    }

    function checkAccess(address _owner, address _user) external view returns (bool) {
        return hasAccess[_owner][_user];
    }

    function getFileCount(address _user) external view returns (uint256) {
        if (_user == msg.sender || hasAccess[_user][msg.sender]) {
            uint256 count = 0;
            for (uint i = 0; i < userFiles[_user].length; i++) {
                if (!userFiles[_user][i].isDeleted) {
                    count++;
                }
            }
            return count;
        }
        return 0;
    }

    function batchGrantAccess(address[] memory _users) external {
        for (uint i = 0; i < _users.length; i++) {
            if (_users[i] != msg.sender && _users[i] != address(0)) {
                this.grantAccess(_users[i]);
            }
        }
    }

    function batchRevokeAccess(address[] memory _users) external {
        for (uint i = 0; i < _users.length; i++) {
            if (hasAccess[msg.sender][_users[i]]) {
                this.revokeAccess(_users[i]);
            }
        }
    }
}