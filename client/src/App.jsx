import Upload from "./artifacts/contracts/Upload.sol/Upload.json";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import FileUpload from "./components/FileUpload";
import Display from "./components/Display";
import Modal from "./components/Modal";
import "./App.css";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProvider = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
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
        } catch (error) {
          console.error("Error loading provider:", error);
          alert("Error connecting to MetaMask");
        } finally {
          setLoading(false);
        }
      } else {
        alert("Please install MetaMask");
        setLoading(false);
      }
    };

    loadProvider();
  }, []);

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>
          <i className="fas fa-cloud-upload-alt"></i>
          Decentralized File System
        </h1>
        <div className="account-info">
          <span className="account-label">
            <i className="fas fa-wallet"></i> Connected Account
          </span>
          <span className="account-address">
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Not connected'}
          </span>
          {account && (
            <span className="tooltip" data-tooltip="Connected to MetaMask">
              <i className="fas fa-check-circle" style={{ color: '#4caf50' }}></i>
            </span>
          )}
        </div>
      </header>

      <div className="main-grid">
        <div className="card">
          <h2>
            <i className="fas fa-upload"></i>
            Upload Files
          </h2>
          <FileUpload contract={contract} account={account} />
        </div>

        <div className="card">
          <h2>
            <i className="fas fa-images"></i>
            Your Gallery
          </h2>
          <Display contract={contract} account={account} />
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <Modal contract={contract} setModalOpen={setModalOpen} />
          </div>
        </div>
      )}

      <button 
        className="share-button pulse" 
        onClick={() => setModalOpen(true)}
        title="Share Access"
      >
        <i className="fas fa-share-alt"></i>
      </button>
    </div>
  );
}

export default App;