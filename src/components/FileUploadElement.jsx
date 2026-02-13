/*
 * individual file upload field for FileUpload.jsx
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

const FileUploadElement = ({
  // id of this file upload
  id,
  // boolean if field is active
  active,
  // number of upload progress (parent does the uploading)
  completion,
  // accepted types
  acceptedTypes,

  // callback to call to close, argument must be id
  close,
  // callback to inform parent that an action will likely happen, argument is id
  incommingAction,
  // callback to tell file to parent, first argument must be id
  selectFile,
}) => {
  const [render, setRender] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const inputRef = useRef(null);

  const handleClick = useCallback((evt) => {
    incommingAction(id);
    const inputElement = inputRef.current;
    if (!inputElement) {
      return;
    }
    if (inputElement.files?.[0]) {
      close(id);
    } else {
      inputElement.click();
    }
  }, [incommingAction, close, id]);

  const handleChange = useCallback((evt) => {
    const file = evt.target.files?.[0];
    if (file?.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else if (previewUrl) {
      setPreviewUrl(null);
      URL.revokeObjectURL(previewUrl);
    }
    selectFile(id, file);
  }, [previewUrl, close, id]);

  useEffect(() => {
    if (active && !render) {
      window.setTimeout(() => {
        setRender(true);
      }, 10);
    }
  }, [active, render]);

  const style = {
    transition: '200ms',
    width: 0,
  }
  if (active && render) {
    style.width = 40;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onTransitionEnd={!active && () => { close(id) }}
      style={style}
      onClick={handleClick}
    >
      <span>📎</span>
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleChange}
        style={{
          position: 'absolute',
          opacity: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          pointerEvents: 'none' // Prevent double click events
        }}
      />
    </div>
  );
}

export default React.memo(FileUploadElement);
