import {useState, useEffect } from "react";

export default function Modal({ setModalOpen, contract }) {
 const [address, setAddress] = useState("");
  const [accessList, setAccessList] = useState([]);

  const share = async () => {
    try {
      const tx = await contract.allow(address);
      await tx.wait();
      alert("Access Granted");
      setModalOpen(false);
    } catch (err) {
      alert("Transaction Failed");
    }
  };

  useEffect(() => {
    const loadAccessList = async () => {
      const list = await contract.shareAccess();
      setAccessList(list);
    };

    if (contract) loadAccessList();
  }, [contract]);

  return (
    <div>
      <h3>Share Access</h3>

      <input
        type="text"
        placeholder="Enter address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <button onClick={share}>Share</button>
      <button onClick={() => setModalOpen(false)}>Cancel</button>

      <h4>People With Access:</h4>
      {accessList.map((item, i) => (
        <p key={i}>
          {item.user} - {item.access ? "Allowed" : "Not Allowed"}
        </p>
      ))}
    </div>
  );
}
