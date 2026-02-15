/*
 * individual file field for FileUpload.jsx
 */

import React, { useState, useEffect } from 'react';

const FileUploadElement = ({
  // id of this file upload
  id,
  // file
  file,
  // boolean if field is active
  active,
  // number of upload progress (parent does the uploading)
  completion,

  // callback to call to close, argument must be id
  close,
  // callback to inform parent that a file shall be removed, argument must be id
  removeFile,
}) => {
  const [render, setRender] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (file.type.startsWidth('image/')) {
      const url = URL.createObjectURL(file);

      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
        console.log('revoke preview url');
      };
    }
    return undefined;
  }, [file]);

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
    background: previewUrl
      // eslint-disable-next-line max-len
      ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('${previewUrl}')`
      : '#4CAF50',
  };
  if (active && render) {
    style.width = 40;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onTransitionEnd={!active && (() => { close(id); })}
      style={style}
      onClick={() => { removeFile(id); }}
    >
      <span>{completion}</span>
    </div>
  );
};

export default React.memo(FileUploadElement);
