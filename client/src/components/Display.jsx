import { useState } from "react";

export default function Display({ contract, account }) {
   const [images, setImages] = useState([]);
  const [otherAddress, setOtherAddress] = useState("");

  const getData = async () => {
    if (!contract) return;

    try {
      const addressToCheck = otherAddress || account;

      const data = await contract.display(addressToCheck);

      setImages(data);
    } catch (error) {
      alert("You don't have access");
    }
  };

  return (
    <>
      <input
        type="text"
        placeholder="Enter Address (optional)"
        value={otherAddress}
        onChange={(e) => setOtherAddress(e.target.value)}
      />

      <button onClick={getData}>Get Data</button>

      <div>
        {images.map((img, i) => (
          <img key={i} src={img} width="200" alt="uploaded" />
        ))}
      </div>
    </>
  );
}
