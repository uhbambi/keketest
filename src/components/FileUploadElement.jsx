/*
 * individual file field for FileUpload.jsx
 */

import React, { useState, useEffect } from 'react';
import { t } from 'ttag';

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
    if (file.type.startsWith('image/')) {
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
      requestAnimationFrame(() => {
        setRender(true);
      });
    }
  }, [active, render]);

  let progressWidth = 0;
  if (completion > 0) {
    progressWidth = completion;
  }
  progressWidth = `${String(progressWidth)}%`;

  let progressColor;
  switch (completion) {
    case 100:
      progressColor = '#22c55e';
      break;
    default:
      progressColor = '#3b82f6';
  }

  const buttonStyle = {
    width: active && render ? 40 : 0,
    transition: 'width 200ms ease-in-out',
    position: 'relative',
    padding: 0,
    border: 'none',
    borderRadius: 4,
    overflow: 'hidden',
    cursor: 'pointer',
  };

  // base image (grayscale)
  const imageBaseStyle = previewUrl ? {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundImage: `url(${previewUrl})`,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    filter: (completion === 100) ? undefined : 'grayscale(100%)',
    opacity: 0.7,
  } : {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    color: 'white',
    opacity: 0.4,
  };

  // Small progress indicator line at bottom (optional additional indicator)
  const progressBarStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: progressWidth,
    height: 3,
    backgroundColor: progressColor,
    transition: 'width 200ms ease-in-out',
    zIndex: 2,
  };

  // X indicator - always visible
  const xIndicatorStyle = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: '0 4px 0 4px',
    backgroundColor: completion === -1 ? '#ef4444' : 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    lineHeight: 1,
  };

  return (
    <button
      tabIndex={0}
      type="button"
      onTransitionEnd={active ? undefined : () => close(id)}
      style={buttonStyle}
      onClick={() => removeFile(id)}
      title={t`Click to remove`}
    >
      <div style={imageBaseStyle}>
        {!previewUrl && '📷'}
      </div>

      <div style={progressBarStyle} />

      <span style={xIndicatorStyle}>
        {completion === -1 ? '!' : '×'}
      </span>
    </button>
  );
};

export default React.memo(FileUploadElement);
