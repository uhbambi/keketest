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
  if (completion && completion !== -1) {
    progressWidth = completion;
  }
  progressWidth = `${String(progressWidth)}%`;

  let progressColor;
  switch (completion) {
    case null:
      progressColor = '#9ca3af';
      break;
    case -1:
      progressColor = '#ef4444';
      break;
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
    // backgroundColor: '#f3f4f6',
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
    filter: 'grayscale(100%)',
    opacity: 0.4,
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

  // colored overlay
  const progressOverlayStyle = previewUrl ? {
    position: 'absolute',
    top: 0,
    left: 0,
    width: progressWidth,
    height: '100%',
    backgroundImage: `url(${previewUrl})`,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    filter: 'grayscale(0%)',
    opacity: 1,
    transition: 'width 200ms ease-in-out',
  } : {
    position: 'absolute',
    top: 0,
    left: 0,
    width: progressWidth,
    height: '100%',
    backgroundColor: progressColor,
    transition: 'width 200ms ease-in-out, background-color 200ms',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    color: 'white',
  };

  // Small progress indicator line at bottom (optional additional indicator)
  const progressBarStyle = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: progressWidth,
    height: 3,
    backgroundColor: progressColor,
    transition: 'width 200ms ease-in-out, background-color 200ms',
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
      {/* Base faded image */}
      <div style={imageBaseStyle}>
        {!previewUrl && '📷'}
      </div>

      {(completion > 0 || previewUrl) && (
      <div style={progressOverlayStyle}>
        {
          !previewUrl && `${completion}%`
        }
      </div>
      )}

      {completion > 0 && (
      <div style={progressBarStyle} />
      )}

      <span style={xIndicatorStyle}>
        {completion === -1 ? '!' : '×'}
      </span>
    </button>
  );
};

export default React.memo(FileUploadElement);
