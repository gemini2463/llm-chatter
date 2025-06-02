import React, { useState, useCallback } from "react";

const FileUploader = ({
  base64Image,
  setBase64Image,
  sentOne,
  setFileFormat,
  textAttachment,
  setTextAttachment,
}) => {
  const [error, setError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFileChange = useCallback((event) => {
    setError("");
    setBase64Image("");

    const file = event.target.files[0];
    if (!file) {
      setError("No file selected.");
      return;
    }

    const txtTypes = ["text/plain", "text/csv"];
    const imgTypes = ["image/png", "image/jpeg", "image/webp"];

    const allowedTypes = [...txtTypes, ...imgTypes];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type.");
      return;
    }

    const reader = new FileReader();
    setFileFormat(file.type);

    reader.onload = () => {
      if (txtTypes.includes(file.type)) {
        const textContent = reader.result;
        setTextAttachment(textContent);
        setBase64Image("");
      }

      if (imgTypes.includes(file.type)) {
        setTextAttachment("");
        setBase64Image(reader.result);
      }
    };

    reader.onerror = (error) => {
      setError("An error occurred while reading the file.");
      console.error("FileReader Error:", error);
    };

    reader.readAsDataURL(file);
  });

  const ToggleImageSize = useCallback(() => {
    setIsExpanded((prev) => !prev);
  });

  return (
    <div>
      {!sentOne && (!base64Image || !textAttachment) && (
        <>
          <form>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.txt,.csv"
              onChange={handleFileChange}
              className="rounded-md border-solid border-1 border-aro-800 bg-aro-300 text-black p-1 cursor-pointer mr-4"
            />
          </form>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </>
      )}
      {(base64Image || textAttachment) && (
        <div style={{ position: "relative", display: "inline-block" }}>
          {base64Image && (
            <>
              <img
                onClick={ToggleImageSize}
                src={base64Image}
                alt="Preview"
                style={{
                  width: isExpanded ? "100%" : "300px",
                  cursor: "pointer",
                  marginTop: "10px",
                }}
              />
              {!sentOne && (
                <i
                  className="fa-solid fa-circle-xmark text-3xl text-morbius-500 cursor-pointer"
                  style={{ position: "absolute", top: "0", right: "-2em" }}
                  onClick={() => setBase64Image("")}
                />
              )}
            </>
          )}
          {textAttachment && (
            <i className="fa-solid fa-file text-dracula-900 text-4xl ml-4 mt-2" />
          )}
        </div>
      )}
    </div>
  );
};
export default FileUploader;
