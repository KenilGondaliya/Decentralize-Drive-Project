import Upload from "./artifacts/contracts/Upload.sol/Upload.json";
import FileNFT from "./artifacts/contracts/FileNFT.sol/FileNFT.json";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import FileUpload from "./components/FileUpload";
import Display from "./components/Display";
import AccessManager from "./components/AccessManager";
import FileManager from "./components/FileManager";
import SharedWithMe from "./components/SharedWithMe";
import NFTGallery from "./components/NFTGallery";
import "./App.css";

function App() {
  const [account, setAccount] = useState("");
  const [uploadContract, setUploadContract] = useState(null);
  const [nftContract, setNftContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("access");
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [nftCount, setNftCount] = useState(0);
  const [activeTab, setActiveTab] = useState("files");

  const UPLOAD_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const NFT_CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  useEffect(() => {
    const loadProvider = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: "eth_requestAccounts" });

          const provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(provider);

          const network = await provider.getNetwork();
          // console.log("Connected to chain ID:", network.chainId.toString());

          if (network.chainId !== 31337n && network.chainId !== 11155111n) {
            setNetworkError(
              "Please connect to Hardhat (Chain ID: 1337) or Sepolia (Chain ID: 11155111)",
            );
          }

          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);

          const uploadContractInstance = new ethers.Contract(
            UPLOAD_CONTRACT_ADDRESS,
            Upload.abi,
            signer,
          );

          setUploadContract(uploadContractInstance);

          // Initialize NFT contract
          const nftContractInstance = new ethers.Contract(
            NFT_CONTRACT_ADDRESS,
            FileNFT.abi,
            signer,
          );
          setNftContract(nftContractInstance);

          // Load stats
          await loadStats(uploadContractInstance, nftContractInstance, address);
        } catch (error) {
          console.error("Error loading provider:", error);
          setNetworkError(
            "Error connecting to MetaMask. Please make sure it's installed and unlocked.",
          );
        } finally {
          setLoading(false);
        }
      } else {
        setNetworkError("Please install MetaMask to use this application");
        setLoading(false);
      }
    };

    loadProvider();

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          window.location.reload();
        } else {
          setAccount("");
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners("accountsChanged");
        window.ethereum.removeAllListeners("chainChanged");
      }
    };
  }, []);

  const loadStats = async (uploadContract, nftContract, address) => {
    try {
      const count = await uploadContract.getFileCount(address);
      setFileCount(Number(count));

      const totalNFTs = await nftContract.tokenCounter();
      setNftCount(Number(totalNFTs));
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const refreshStats = async () => {
    if (uploadContract && nftContract && account) {
      await loadStats(uploadContract, nftContract, account);
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading application...</p>
        </div>
      </div>
    );
  }

  if (networkError) {
    return (
      <div className="app-container">
        <div className="error-screen">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>Connection Error</h2>
          <p>{networkError}</p>
          {!window.ethereum && (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
            >
              Install MetaMask
            </a>
          )}
          {window.ethereum && !account && (
            <button
              onClick={() =>
                window.ethereum.request({ method: "eth_requestAccounts" })
              }
              className="btn"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    );

  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <h1>
            <i className="fas fa-cloud-upload-alt"></i>
            Decentralized File System & NFT Gallery
          </h1>
        </div>
        <div className="header-right">
          <div className="account-info">
            <span className="account-label">
              <i className="fas fa-wallet"></i>
            </span>
            <span className="account-address" title={account}>
              {account
                ? `${account.slice(0, 6)}...${account.slice(-4)}`
                : "Not connected"}
            </span>
            {account && (
              <span
                className="status-badge connected"
                title="Connected to MetaMask"
              >
                <i className="fas fa-check-circle"></i>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="tab-navigation">
        <button
          className={`tab-nav-btn ${activeTab === "files" ? "active" : ""}`}
          onClick={() => setActiveTab("files")}
        >
          <i className="fas fa-folder"></i>
          File System
        </button>
        <button
          className={`tab-nav-btn ${activeTab === "nfts" ? "active" : ""}`}
          onClick={() => setActiveTab("nfts")}
        >
          <i className="fas fa-image"></i>
          NFT Gallery
        </button>
      </div>

      <div className="main-content">
        {activeTab === "files" ? (
          <>
            <div className="stats-bar">
              <div className="stat-item">
                <i className="fas fa-file"></i>
                <span>Your Files: {fileCount}</span>
              </div>
              <div className="stat-item">
                <i className="fas fa-users"></i>
                <span>NFTs Minted: {nftCount}</span>
              </div>
            </div>

            <div className="main-grid">
              <div className="card upload-card">
                <div className="card-header">
                  <h2>
                    <i className="fas fa-upload"></i>
                    Upload Files
                  </h2>
                  <p className="card-subtitle">
                    Upload your files to IPFS via Pinata
                  </p>
                </div>
                <FileUpload
                  uploadContract={uploadContract}
                  nftContract={nftContract}
                  account={account}
                  provider={provider}
                  onUploadSuccess={refreshStats}
                />
              </div>

              <div className="card gallery-card">
                <div className="card-header">
                  <h2>
                    <i className="fas fa-images"></i>
                    Your Gallery
                  </h2>
                  <p className="card-subtitle">
                    View and manage your uploaded files
                  </p>
                </div>
                <Display
                  uploadContract={uploadContract}
                  nftContract={nftContract}
                  account={account}
                  onFileChange={refreshStats}
                />
              </div>
            </div>
          </>
        ) : (
          <NFTGallery
            nftContract={nftContract}
            account={account}
            provider={provider}
          />
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            {modalType === "access" && (
              <AccessManager
                uploadContract={uploadContract}
                setModalOpen={setModalOpen}
                account={account}
                onAccessChange={refreshStats}
              />
            )}
            {modalType === "fileManager" && (
              <FileManager
                uploadContract={uploadContract}
                setModalOpen={setModalOpen}
                account={account}
                onFileUpdate={refreshStats}
              />
            )}
            {modalType === "shared" && (
              <SharedWithMe
                uploadContract={uploadContract}
                setModalOpen={setModalOpen}
                account={account}
              />
            )}
          </div>
        </div>
      )}

      <div className="fab-menu">
        <button
          className="fab-main"
          onClick={() => openModal("access")}
          title="Manage Access"
        >
          <i className="fas fa-share-alt"></i>
        </button>
        <button
          className="fab-item"
          onClick={() => openModal("fileManager")}
          title="Manage Files"
        >
          <i className="fas fa-cog"></i>
        </button>
        <button
          className="fab-item"
          onClick={() => openModal("shared")}
          title="Shared With Me"
        >
          <i className="fas fa-users"></i>
        </button>
      </div>
    </div>
  );
}

export default App;
