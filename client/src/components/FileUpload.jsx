import { useState } from "react";
import axios from "axios";

export default function FileUpload({ contract, account }) {
  const [file, setFile] = useState(null);
   const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file || !contract) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const resFile = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers: {
            pinata_api_key: "80000672308d07d88748",
            pinata_secret_api_key: "c237205f4f9b49ec937167509bfa8b9c283ea8b7e7895fb2759438873fd03d72",
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const ImgHash = `https://gateway.pinata.cloud/ipfs/${resFile.data.IpfsHash}`;

      const tx = await contract.add(ImgHash);
      await tx.wait();

      alert("Image uploaded successfully!");
      setFile(null);
    } catch (error) {
      console.error(error);
      alert("Upload failed");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        disabled={!account}
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button type="submit">Upload</button>
    </form>
  );
}
