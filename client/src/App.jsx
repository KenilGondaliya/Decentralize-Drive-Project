import Upload from "./artifacts/contracts/Upload.sol/Upload.json";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import FileUpload from "./components/FileUpload";
import Display from "./components/display";
import Modal from "./components/Modal";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const loadProvider = async () => {
      if (window.ethereum) {
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
      } else {
        alert("Please install MetaMask");
      }
    };

    loadProvider();
  }, []);

  return (
    <>
       <div>
      <h2>Decentralized File System</h2>
      <p>Account: {account}</p>

      <FileUpload contract={contract} account={account} />

      <Display contract={contract} account={account} />

      {modalOpen && (
        <Modal contract={contract} setModalOpen={setModalOpen} />
      )}

      <button onClick={() => setModalOpen(true)}>Share Access</button>
    </div>
    </>
  );  
}

export default App;
