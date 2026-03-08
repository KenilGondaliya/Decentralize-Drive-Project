// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FileNFT is ERC721URIStorage, Ownable {

    uint256 public tokenCounter;

    mapping(string => uint256) public fileToToken;

    struct NFTInfo {
        address creator;
        string fileUrl;
        uint256 mintedAt;
    }

    struct Provenance {
        address owner;
        uint256 timestamp;
    }

    mapping(uint256 => NFTInfo) public nftInfo;
    mapping(uint256 => Provenance[]) public ownershipHistory;

    event FileMinted(
        address indexed creator,
        uint256 indexed tokenId,
        string tokenURI
    );

    constructor() ERC721("DecentralizedFileNFT", "DFNFT") Ownable(msg.sender) {
        tokenCounter = 0;
    }

    function mintFileNFT(
        string memory metadataURI,
        string memory fileUrl
    ) public returns (uint256) {

        uint256 tokenId = tokenCounter;

        _safeMint(msg.sender, tokenId);

        _setTokenURI(tokenId, metadataURI);

        fileToToken[fileUrl] = tokenId;

        nftInfo[tokenId] = NFTInfo({
            creator: msg.sender,
            fileUrl: fileUrl,
            mintedAt: block.timestamp
        });

        ownershipHistory[tokenId].push(
            Provenance(msg.sender, block.timestamp)
        );

        tokenCounter++;

        emit FileMinted(msg.sender, tokenId, metadataURI);

        return tokenId;
    }

    function getHistory(uint256 tokenId)
        public
        view
        returns (Provenance[] memory)
    {
        return ownershipHistory[tokenId];
    }

    function transferNFT(address to, uint256 tokenId) public {

        require(ownerOf(tokenId) == msg.sender, "Not owner");

        safeTransferFrom(msg.sender, to, tokenId);

        ownershipHistory[tokenId].push(
            Provenance(to, block.timestamp)
        );
    }
}