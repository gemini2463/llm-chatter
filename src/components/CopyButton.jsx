import { useState, useCallback } from "react";

const COPY_BUTTON_DELAY = 150;

const CopyButton = ({ contentText, copyClick }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyClick(contentText);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, COPY_BUTTON_DELAY);
  }, [contentText, copyClick]);

  return (
    <i
      onClick={handleCopy}
      className={`text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-pointer ${
        isCopied ? "text-blade-300" : ""
      }`}
    />
  );
};

export default CopyButton;