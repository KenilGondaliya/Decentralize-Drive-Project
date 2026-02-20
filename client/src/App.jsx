import Upload from "./artifacts/contracts/Upload.sol/Upload.json";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import FileUpload from "./components/FileUpload";
import Display from "./components/display";
import Modal from "./components/Modal";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
  const loadProvider = async () => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);

      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);

      const contractAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

      const contract = new ethers.Contract(
        contractAddress,
        Upload.abi,
        signer
      );

      console.log(contract);

      setContract(contract);
      setProvider(provider);
    } else {
      console.error("Please install MetaMask!");
    }
  };

  loadProvider();
}, []);

  return (
    <>
      <div>
        <h1>Decentralized File System</h1>
      </div>
    </>
  );
}

export default App;
