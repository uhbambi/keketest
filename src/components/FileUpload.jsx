/*
 * Component to upload files
 */
import React, {
  useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle,
} from 'react';

import FileUploadElement from './FileUploadElement.jsx';

const FileUpload = forwardRef(({
  acceptedTypes = "image/*,video/*",
  maxFiles = 4,
}, ref) => {
  /*
   * array with information for upload fields
   */
  const [inputFields, setInputFields] = useState([{
    id: 1, file: null, active: true, completion: 0,
  }]);
  /*
   * array of AbortControllers for current running uploads
   * [ abortController, ... ]
   */
  const currentUploadsControllersRef = useRef([]);
  /*
   * array of fieldIds per upload, since every upload can upload multiple files
   * [ [id1, id2,...], ... ]
   */
  const [currentUploadFields, setCurrentUploadFields] = useState([]);
  /*
   * timeout id, if we are currently waiting before next upload
   */
  const uploadTimeoutRef = useRef(null);

  /*
   * The length you have to go to, to expose a function to a parent element is
   * unreal.
   * Should be different in react >= 19
   */
  useImperativeHandle(ref, () => ({
    uploadFile: async () => {
    }
  }), []);

  useEffect(() => {
    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
      uploadTimeoutRef.current = null;
    }
    const uploadControllers = currentUploadsControllersRef.current;
    for (let i = 0; i < uploadControllers.length; i += 1) {
      const controller = uploadControllers[i];
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
    /*
     * null on this ref used to detect that component is unmounted
     */
    currentUploadsControllersRef.current = null;
  }, []);

  const incommingAction = useCallback((id) => {
    // cancel scheduled uploads
    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
      uploadTimeoutRef.current = null;
    }
    // cancel current upload that includes field
    const index = currentUploadFields.findIndex((ids) => ids.includes(id));
    if (index !== -1) {
      const controller = currentUploadsControllersRef.current?.[index];
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
    }
  }, [currentUploadFields]);

  const selectFile = useCallback((id, file) => {
    setInputFields(inputFields.map((field) => {
      if (field.id !== id) {
        return field;
      }
      if (file) {
        return {
          ...field,
          file,
        };
      } else {
        return {
          ...field,
          active: false,
        }
      }
    }));
  }, [inputFields]);

  const close = useCallback((id) => {
    setInputFields(inputFields.filter((field) => field !== id));
  }, [inputFields]);

  const uploadFile = useCallback(async () => {
  }, []);

  const triggerDelayedUpload = useCallback(() => {
    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
    }
    uploadTimeoutRef.current = setTimeout(uploadFile, 2500);
  }, []);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleButtonClick}
      >
        <span>📎</span>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          onChange={handleInputChange}
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
    </>
  );
});

export default FileUpload;
