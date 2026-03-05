import Upload from "./artifacts/contracts/Upload.sol/Upload.json";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import FileUpload from "./components/FileUpload";
import Display from "./components/Display";
import AccessManager from "./components/AccessManager";
import "./App.css";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState("");

  useEffect(() => {
    const loadProvider = async () => {
      if (window.ethereum) {
        try {
          // Request account access
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          
          const provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(provider);
          
          // Get network
          const network = await provider.getNetwork();
          
          // Check if we're on the correct network (adjust as needed)
          if (network.chainId !== 1337n && network.chainId !== 11155111n) {
            setNetworkError("Please connect to Hardhat (Chain ID: 1337) or Sepolia (Chain ID: 11155111)");
          }

          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);

          // Contract address - update this with your deployed contract address
          const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
          
          const uploadContract = new ethers.Contract(
            contractAddress,
            Upload.abi,
            signer
          );

          setContract(uploadContract);
        } catch (error) {
          console.error("Error loading provider:", error);
          setNetworkError("Error connecting to MetaMask. Please make sure it's installed and unlocked.");
        } finally {
          setLoading(false);
        }
      } else {
        setNetworkError("Please install MetaMask to use this application");
        setLoading(false);
      }
    };

    loadProvider();

    // Handle account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          window.location.reload();
        } else {
          setAccount("");
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  const connectWallet = async () => {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      window.location.reload();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
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
            <button onClick={connectWallet} className="btn">
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
            Decentralized File System
          </h1>
        </div>
        <div className="header-right">
          <div className="account-info">
            <span className="account-label">
              <i className="fas fa-wallet"></i>
            </span>
            <span className="account-address" title={account}>
              {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected'}
            </span>
            {account && (
              <span className="status-badge connected" title="Connected to MetaMask">
                <i className="fas fa-check-circle"></i>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className="stats-bar">
          <div className="stat-item">
            <i className="fas fa-file"></i>
            <span>Your Files</span>
          </div>
          <div className="stat-item">
            <i className="fas fa-share-alt"></i>
            <span>Shared Access</span>
          </div>
          <div className="stat-item">
            <i className="fas fa-database"></i>
            <span>IPFS Storage</span>
          </div>
        </div>

        <div className="main-grid">
          <div className="card upload-card">
            <div className="card-header">
              <h2>
                <i className="fas fa-upload"></i>
                Upload Files
              </h2>
              <p className="card-subtitle">Upload your files to IPFS via Pinata</p>
            </div>
            <FileUpload 
              contract={contract} 
              account={account} 
              provider={provider}
            />
          </div>

          <div className="card gallery-card">
            <div className="card-header">
              <h2>
                <i className="fas fa-images"></i>
                Your Gallery
              </h2>
              <p className="card-subtitle">View and manage your uploaded files</p>
            </div>
            <Display contract={contract} account={account} />
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <AccessManager 
              contract={contract} 
              setModalOpen={setModalOpen} 
              account={account} 
            />
          </div>
        </div>
      )}

      <button 
        className="share-fab" 
        onClick={() => setModalOpen(true)}
        title="Manage Access"
      >
        <i className="fas fa-share-alt"></i>
      </button>
    </div>
  );
}

export default App;