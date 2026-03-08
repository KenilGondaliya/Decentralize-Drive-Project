import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

export default function Display({ contract, account, onFileChange }) {
  const [files, setFiles] = useState([]);
  const [otherAddress, setOtherAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [previewFile, setPreviewFile] = useState(null);
  const [sortBy, setSortBy] = useState("date");
  // const [debug, setDebug] = useState(null);

  const getFiles = useCallback(async () => {
    if (!contract || !account) {
      setMessage({
        type: "error",
        text: "Contract not initialized or account not connected",
      });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });
    // setDebug(null);

    try {
      const addressToCheck = otherAddress || account;
      console.log("Checking files for address:", addressToCheck);

      if (otherAddress && !ethers.isAddress(otherAddress)) {
        setMessage({ type: "error", text: "Invalid Ethereum address" });
        setLoading(false);
        return;
      }

      let hasAccess = true;
      if (otherAddress && otherAddress !== account) {
        try {
          hasAccess = await contract.checkAccess(otherAddress, account);
          console.log("Access check result:", hasAccess);
          if (!hasAccess) {
            setMessage({
              type: "error",
              text: "You don't have access to view these files",
            });
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error checking access:", error);
        }
      }

      const data = await contract.getFiles(addressToCheck);
      console.log("Raw data from contract:", data);

      if (!data || data.length === 0) {
        setMessage({ type: "info", text: "No files found" });
        setFiles([]);
        setLoading(false);
        return;
      }

      if (data.length > 0) {
        console.log("First file structure:", {
          url: data[0].url,
          name: data[0].name,
          fileType: data[0].fileType,
          timestamp: data[0].timestamp?.toString(),
          size: data[0].size?.toString(),
          isDeleted: data[0].isDeleted,
        });
      }

      let processedFiles = [];

      if (Array.isArray(data)) {
        
        if (data.length > 0 && Array.isArray(data[0])) {
          
          processedFiles = data.map((fileTuple, index) => ({
            url: fileTuple[0] || "",
            name: fileTuple[1] || "Unnamed file",
            fileType: fileTuple[2] || "application/octet-stream",
            timestamp: fileTuple[3] ? Number(fileTuple[3]) : 0,
            size: fileTuple[4] ? Number(fileTuple[4]) : 0,
            isDeleted: fileTuple[5] || false,
            id: index,
          }));
        } else {
          
          processedFiles = data.map((file, index) => ({
            url: file.url || "",
            name: file.name || "Unnamed file",
            fileType: file.fileType || "application/octet-stream",
            timestamp: file.timestamp ? Number(file.timestamp) : 0,
            size: file.size ? Number(file.size) : 0,
            isDeleted: file.isDeleted || false,
            id: index,
          }));
        }
      }
    
      const activeFiles = processedFiles.filter((file) => !file.isDeleted);
      console.log("Processed active files:", activeFiles);

      const sortedFiles = sortFiles(activeFiles, sortBy);
      setFiles(sortedFiles);

      if (activeFiles.length === 0) {
        setMessage({ type: "info", text: "No files found" });
      }

      // Set debug info
      // setDebug({
      //   rawDataLength: data.length,
      //   processedCount: processedFiles.length,
      //   activeCount: activeFiles.length,
      //   sampleFile: activeFiles.length > 0 ? activeFiles[0] : null
      // });
    } catch (error) {
      console.error("Error in getFiles:", error);
      setMessage({
        type: "error",
        text:
          error.message || "Failed to load files. Check console for details.",
      });
    } finally {
      setLoading(false);
    }
  }, [contract, account, otherAddress, sortBy]);

  const sortFiles = (filesArray, sortMethod) => {
    const sorted = [...filesArray];
    switch (sortMethod) {
      case "name":
        return sorted.sort((a, b) =>
          (a.name || "").localeCompare(b.name || ""),
        );
      case "size":
        return sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
      case "date":
      default:
        return sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
  };

  useEffect(() => {
    if (account && contract) {
      getFiles();
    }
  }, [account, contract, getFiles]);

  const handlePreview = (file) => {
    setPreviewFile(file);
  };

  const handleDownload = async (url, name) => {
    try {
      window.open(url, "_blank");
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const handleDelete = async (fileId) => {
    if (!contract) return;

    if (!window.confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      const tx = await contract.removeFile(fileId);
      await tx.wait();
      await getFiles();
      setMessage({ type: "success", text: "File deleted successfully" });

      
      await getFiles();
      if (onFileChange) onFileChange();
      setMessage({ type: "success", text: "File deleted successfully" });

      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 3000);
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Failed to delete file" });
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (fileType) => {
    const type = (fileType || "").toLowerCase();

    if (type.startsWith("image/")) return "fa-image";
    if (type.startsWith("video/")) return "fa-video";
    if (type.startsWith("audio/")) return "fa-music";
    if (type.includes("pdf")) return "fa-file-pdf";
    if (type.includes("word") || type.includes("document"))
      return "fa-file-word";
    if (type.includes("zip") || type.includes("compressed"))
      return "fa-file-archive";
    if (type.includes("text")) return "fa-file-alt";
    return "fa-file";
  };

  const isImage = (fileType) => {
    return (fileType || "").toLowerCase().startsWith("image/");
  };

  const isVideo = (fileType) => {
    return (fileType || "").toLowerCase().startsWith("video/");
  };

  const isAudio = (fileType) => {
    return (fileType || "").toLowerCase().startsWith("audio/");
  };

  // Debug component to show in UI
  // const DebugPanel = () => {
  //   if (!debug) return null;

  //   return (
  //     <div style={{
  //       background: '#f0f0f0',
  //       padding: '10px',
  //       margin: '10px 0',
  //       borderRadius: '5px',
  //       fontSize: '12px',
  //       border: '1px solid #ccc'
  //     }}>
  //       <h4>Debug Info:</h4>
  //       <pre style={{ overflow: 'auto' }}>
  //         {JSON.stringify(debug, null, 2)}
  //       </pre>
  //     </div>
  //   );
  // };

  return (
    <div className="display-container">
      <div className="display-controls">
        <div className="search-box">
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            className="input-field"
            placeholder="Enter address to view (optional)"
            value={otherAddress}
            onChange={(e) => setOtherAddress(e.target.value)}
          />
        </div>

        <div className="sort-controls">

          <button
            onClick={getFiles}
            className="btn btn-secondary refresh-btn"
            disabled={loading}
          >
            <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          <i
            className={`fas fa-${
              message.type === "info"
                ? "info-circle"
                : message.type === "success"
                ? "check-circle"
                : "exclamation-circle"
            }`}
          ></i>
          {message.text}
        </div>
      )}

      {files.length > 0 ? (
        <div className="files-grid">
          {files.map((file, index) => (
            <div key={index} className="file-card">
              <div
                className={`file-preview ${
                  !isImage(file.fileType) ? "file-icon" : ""
                }`}
                onClick={() => handlePreview(file)}
              >
                {isImage(file.fileType) ? (
                  <img
                    src={file.url}
                    alt={file.name || "Image"}
                    loading="lazy"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = "none";
                      e.target.parentNode.innerHTML =
                        '<i class="fas fa-image"></i>';
                    }}
                  />
                ) : isVideo(file.fileType) ? (
                  <video src={file.url} />
                ) : (
                  <i
                    className={`fas ${getFileIcon(file.fileType)}`}
                    style={{ fontSize: "3rem" }}
                  ></i>
                )}
              </div>

              <div className="file-info">
                <h4 title={file.name || "Unnamed file"}>
                  {file.name
                    ? file.name.length > 20
                      ? file.name.substring(0, 20) + "..."
                      : file.name
                    : "Unnamed file"}
                </h4>
                <div className="file-meta">
                  <span>
                    <i className="fas fa-calendar"></i>
                    {file.timestamp
                      ? new Date(
                          Number(file.timestamp) * 1000,
                        ).toLocaleDateString()
                      : "Unknown"}
                  </span>
                  <span>
                    <i className="fas fa-database"></i>
                    {formatFileSize(Number(file.size))}
                  </span>
                </div>
              </div>

              <div className="file-actions">
                <button
                  onClick={() => handlePreview(file)}
                  className="action-btn preview"
                  title="Preview"
                >
                  <i className="fas fa-eye"></i>
                </button>

                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-btn download"
                  title="Download"
                >
                  <i className="fas fa-download"></i>
                </a>

                {(!otherAddress || otherAddress === account) && (
                  <button
                    className="action-btn delete"
                    onClick={() => handleDelete(file.id)}
                    title="Delete"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading &&
        !message.text && (
          <div className="empty-state">
            <i className="fas fa-folder-open"></i>
            <h3>No Files Yet</h3>
            <p>Upload your first file to get started</p>
          </div>
        )
      )}

      {previewFile && (
        <div className="preview-overlay" onClick={() => setPreviewFile(null)}>
          <div className="preview-content" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <h3>{previewFile.name || "Unnamed file"}</h3>
              <button
                className="close-btn"
                onClick={() => setPreviewFile(null)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="preview-body">
              {isImage(previewFile.fileType) ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name || "Preview"}
                  style={{ maxWidth: "100%", maxHeight: "60vh" }}
                />
              ) : isVideo(previewFile.fileType) ? (
                <video
                  controls
                  src={previewFile.url}
                  style={{ maxWidth: "100%", maxHeight: "60vh" }}
                />
              ) : isAudio(previewFile.fileType) ? (
                <audio controls src={previewFile.url} />
              ) : (
                <div className="file-icon-large">
                  <i
                    className={`fas ${getFileIcon(previewFile.fileType)}`}
                    style={{ fontSize: "5rem" }}
                  ></i>
                  <p>File Type: {previewFile.fileType || "Unknown"}</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    <i className="fas fa-download"></i> Download
                  </a>
                </div>
              )}
            </div>

            <div className="preview-footer">
              <div className="file-details">
                <span>
                  <strong>Type:</strong> {previewFile.fileType || "Unknown"}
                </span>
                <span>
                  <strong>Size:</strong>{" "}
                  {formatFileSize(Number(previewFile.size))}
                </span>
                <span>
                  <strong>Uploaded:</strong>{" "}
                  {previewFile.timestamp
                    ? new Date(
                        Number(previewFile.timestamp) * 1000,
                      ).toLocaleString()
                    : "Unknown"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
