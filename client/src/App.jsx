import Upload from "./artifacts/contracts/Upload.sol/Upload.json";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import FileUpload from "./components/FileUpload";
import Display from "./components/Display";
import AccessManager from "./components/AccessManager";
import FileManager from "./components/FileManager";
import SharedWithMe from "./components/SharedWithMe";
import "./App.css";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('access');
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [accessCount, setAccessCount] = useState(0);

  useEffect(() => {
    const loadProvider = async () => {
      if (window.ethereum) {
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          
          const provider = new ethers.BrowserProvider(window.ethereum);
          setProvider(provider);
          
          const network = await provider.getNetwork();
          
          if (network.chainId !== 1337n && network.chainId !== 11155111n) {
            setNetworkError("Please connect to Hardhat (Chain ID: 1337) or Sepolia (Chain ID: 11155111)");
          }

          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);

          const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
          
          const uploadContract = new ethers.Contract(
            contractAddress,
            Upload.abi,
            signer
          );

          setContract(uploadContract);
          
          // Load stats
          await loadStats(uploadContract, address);
          
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

  const loadStats = async (contract, address) => {
    try {
  
      const count = await contract.getFileCount(address);
      setFileCount(Number(count));
      
      const accessList = await contract.getAccessList();
      setAccessCount(accessList.filter(item => item.access).length);
      
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const refreshStats = async () => {
    if (contract && account) {
      await loadStats(contract, account);
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
              {account ? account : 'Not connected'}
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
              onUploadSuccess={refreshStats}
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
            <Display 
              contract={contract} 
              account={account} 
              onFileChange={refreshStats}
            />
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            {modalType === 'access' && (
              <AccessManager 
                contract={contract} 
                setModalOpen={setModalOpen} 
                account={account}
                onAccessChange={refreshStats}
              />
            )}
            {modalType === 'fileManager' && (
              <FileManager
                contract={contract}
                setModalOpen={setModalOpen}
                account={account}
                onFileUpdate={refreshStats}
              />
            )}
            {modalType === 'shared' && (
              <SharedWithMe
                contract={contract}
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
          onClick={() => openModal('access')}
          title="Manage Access"
        >
          <i className="fas fa-share-alt"></i>
        </button>
        <button 
          className="fab-item" 
          onClick={() => openModal('fileManager')}
          title="Manage Files"
        >
          <i className="fas fa-cog"></i>
        </button>
        <button 
          className="fab-item" 
          onClick={() => openModal('shared')}
          title="Shared With Me"
        >
          <i className="fas fa-users"></i>
        </button>
      </div>
    </div>
  );
}

export default App;