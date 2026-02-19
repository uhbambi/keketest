/*
 * Component to upload files
 */
import React, {
  useEffect, useState, useCallback, useRef, useLayoutEffect,
} from 'react';
import { t } from 'ttag';
import { ImAttachment } from 'react-icons/im';

import FileUploadElement from './FileUploadElement.jsx';
import {
  requestFileUpload, requestFileUploadPreflight,
} from '../store/actions/fetch.js';
import {
  addIdToFilename, extractIdFromFilename,
} from '../utils/media/utils.js';

const FileUpload = ({
  acceptedTypes = 'image/*,video/*',
  maxFiles = 4,
  // minimum height of elements
  minHeight,
  // callback to print errors, gets array of error messages
  printErrors,
  // ref that we define a function on, that the parent calls when all should
  // be uploaded
  uploadRef,
}) => {
  /*
   * whether or not input button is active annd rendered, used for animating it
   * similar to FileUploadElement
   * 0: fade-in width:0
   * 1: shown
   * 2: fade-out width:0
   * 3: hidden
   */
  const [inputButtonState, setInputButtonState] = useState(2);
  /*
   * amount of currently displayed FileUploadElements, tracked for efficient
   * inputButton fade-in fade-out
   */
  const [displayedUploadElements, setDisplayedUploadElements] = useState(0);
  /*
   * array with information for selected files
   * [{ id, file, active, completion, [fileInfo] }, ...]
   * completion:
   *   undefined if file not checked
   *   null if checked and upload not started yet
   *   -1 when upload failed,
   *   0-100 progress otherwise
   */
  const [fileInfos, setFileInfos] = useState([]);
  /*
   * object with informations of uploads
   * {
   *   uploads: [{
   *     controller: AbortController,
   *     promise,
   *     ids: Set<id>,
   *   }], // also includes preflights
   *   uploadTimeout, // timeout for auto-upload
   *   preflightTimeout, // timeout for preflight
   *   incrId, // incrmeneting id for files
   *   unmounted, // boolean
   * }
   */
  const uploadInfoRef = useRef({
    preflightTimeout: null, uploadTimeout: null,
    incrId: 1, uploads: [], unmounted: false,
  });

  const inputRef = useRef(null);

  const handleInputClick = useCallback(() => {
    const inputElement = inputRef.current;
    if (!inputElement) {
      return;
    }
    // TODO no need to cancel uploads here, its for testing
    if (uploadInfoRef.current.uploadTimeout) {
      clearTimeout(uploadInfoRef.current.uploadTimeout);
      uploadInfoRef.current.uploadTimeout = null;
    }
    if (uploadInfoRef.current.preflightTimeout) {
      clearTimeout(uploadInfoRef.current.preflightTimeout);
      uploadInfoRef.current.preflightTimeout = null;
    }
    inputElement.click();
  }, []);

  /**
   * upload file or preflight
   */
  const uploadFile = useCallback(async (preflight) => {
    const files = [];
    const ids = new Set();

    const timeoutName = (preflight) ? 'preflightTimeout' : 'uploadTimeout';
    const completionCheck = (preflight) ? undefined : null;

    await new Promise((resolve) => {
      setFileInfos((oldInfos) => {
        const newInfos = oldInfos.map((info) => {
          if (info.active && info.completion === completionCheck) {
            files.push(info.file);
            ids.add(info.id);
            return {
              ...info,
              completion: 0,
            };
          }
          return info;
        });
        resolve();
        return newInfos;
      });
    });

    if (!files.length) {
      return;
    }

    if (uploadInfoRef.current[timeoutName]) {
      clearTimeout(uploadInfoRef.current[timeoutName]);
      uploadInfoRef.current[timeoutName] = null;
    }

    const uploadInfo = { ids };
    let resolvePromise;
    uploadInfo.promise = new Promise((resolve) => {
      resolvePromise = () => {
        uploadInfoRef.current.uploads = uploadInfoRef.current.uploads.filter(
          (p) => p !== uploadInfo,
        );
        resolve();
      };
    });
    uploadInfo.controller = new AbortController();
    uploadInfoRef.current.uploads.push(uploadInfo);

    let response;
    if (preflight) {
      response = await requestFileUploadPreflight(files, uploadInfo.controller);
    } else {
      response = await requestFileUpload(
        files, uploadInfo.controller, (complete) => {
          setFileInfos((oldInfos) => oldInfos.map((info) => {
            if (ids.has(info.id)) {
              return {
                ...info,
                completion: complete,
              };
            }
            return info;
          }));
        },
      );
    }

    // if component is already unmounted, get out
    if (uploadInfoRef.current.unmounted) {
      resolvePromise();
      return;
    }

    if (response === null) {
      // aborted
      setFileInfos((oldInfos) => oldInfos.map((info) => {
        if (ids.has(info.id)) {
          return {
            ...info,
            completion: completionCheck,
          };
        }
        return info;
      }));
      resolvePromise();
      return;
    }

    const { availableFiles, readyToUpload, errors } = response;
    if (availableFiles) {
      for (let i = 0; i < availableFiles.length; i += 1) {
        /*
         *   hash,
         *   extension,
         *   mimeType,
         *   shortId,
         *   name,
         *   originalFilename,
         *   [existed],
         */
        const fileInfo = availableFiles[i];
        const [name, id] = extractIdFromFilename(fileInfo.name);
        fileInfo.name = name;
        fileInfo.id = id;
      }
    }
    if (readyToUpload) {
      for (let i = 0; i < readyToUpload.length; i += 1) {
        const fileInfo = readyToUpload[i];
        const [name, id] = extractIdFromFilename(fileInfo.name);
        fileInfo.name = name;
        fileInfo.id = id;
      }

      if (uploadInfoRef.current.uploadTimeout) {
        clearTimeout(uploadInfoRef.current.uploadTimeout);
      }
      uploadInfoRef.current.uploadTimeout = setTimeout(uploadFile, 3000);
    }

    setFileInfos((oldInfos) => oldInfos.map((info) => {
      const { id } = info;
      if (ids.has(id)) {
        const fileInfo = availableFiles?.find((ui) => ui.id === id);
        if (fileInfo) {
          return {
            ...info,
            fileInfo,
            completion: 100,
          };
        }
        if (readyToUpload?.find((ui) => ui.id === id)) {
          return {
            ...info,
            completion: null,
          };
        }
        return {
          ...info,
          completion: -1,
        };
      }
      return info;
    }));

    if (errors) {
      // error
      if (printErrors) {
        printErrors(errors);
      } else {
        errors.forEach(console.log);
      }
    }

    resolvePromise();
  }, [printErrors]);

  const doPreflight = useCallback(() => uploadFile(true), [uploadFile]);

  const handleInputChange = useCallback((evt) => {
    let file = evt.target.files?.[0];
    if (file) {
      uploadInfoRef.current.incrId += 1;
      // add id to filename
      const id = uploadInfoRef.current.incrId;
      file = new File([file], addIdToFilename(file.name, id), {
        type: file.type,
        lastModified: file.lastModified,
      });

      setFileInfos((oldInfos) => [
        ...oldInfos, {
          id, file, active: true,
        },
      ]);
      setDisplayedUploadElements((c) => c + 1);
      evt.target.value = '';
      // schedule upload
      if (uploadInfoRef.current.uploadTimeout) {
        clearTimeout(uploadInfoRef.current.uploadTimeout);
        uploadInfoRef.current.uploadTimeout = null;
      }
      if (uploadInfoRef.current.preflightTimeout) {
        clearTimeout(uploadInfoRef.current.preflightTimeout);
      }
      uploadInfoRef.current.preflightTimeout = setTimeout(doPreflight, 1000);
    }
  }, [doPreflight]);

  useEffect(() => {
    /**
     * function called by the parent when it wants to force all uploads
     * and get the files
     * @return [{
     *   hash,
     *   extension,
     *   mimeType,
     *   shortId,
     *   name,
     *   originalFilename,
     *   [existed],
     * }, ...]
     */
    uploadRef.current = async () => {
      // upload the rest
      if (uploadInfoRef.current.preflightTimeout) {
        clearTimeout(uploadInfoRef.current.preflightTimeout);
        uploadInfoRef.current.preflightTimeout = null;
      }
      await doPreflight(true);
      if (uploadInfoRef.current.uploadTimeout) {
        clearTimeout(uploadInfoRef.current.uploadTimeout);
        uploadInfoRef.current.uploadTimeout = null;
      }
      await uploadFile();
      /* wait for running uploads */
      await Promise.all(uploadInfoRef.current.uploads.map((i) => i.promise));

      const oldInfos = await new Promise((resolve) => {
        setFileInfos((infos) => {
          resolve(infos);
          return [];
        });
      });
      setDisplayedUploadElements(0);
      const finishedFileInfos = [];
      for (let i = 0; i < oldInfos.length; i += 1) {
        const { fileInfo } = oldInfos[i];
        if (fileInfo) {
          finishedFileInfos.push(fileInfo);
        }
      }

      return finishedFileInfos;
    };
  }, [uploadRef, uploadFile, doPreflight]);

  useEffect(() => () => {
    // clear timeouts
    if (uploadInfoRef.current.uploadTimeout) {
      clearTimeout(uploadInfoRef.current.uploadTimeout);
      uploadInfoRef.current.uploadTimeout = null;
    }
    if (uploadInfoRef.current.preflightTimeout) {
      clearTimeout(uploadInfoRef.current.preflightTimeout);
      uploadInfoRef.current.preflightTimeout = null;
    }
    /*
      * null on this ref used to detect that component is unmounted
      */
    uploadInfoRef.current.unmounted = true;
    // cancel uploads
    const uploadInfos = uploadInfoRef.current.uploads;
    for (let i = 0; i < uploadInfos.length; i += 1) {
      const { controller } = uploadInfos[i];
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
  }, []);

  const removeFile = useCallback((id) => {
    // cancel current upload that includes field
    const uploadInfo = uploadInfoRef.current.uploads.find(
      ({ ids }) => ids.includes(id),
    );
    if (uploadInfo) {
      const { controller } = uploadInfo;
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
    }
    // remove file
    setFileInfos((oldInfos) => oldInfos.map((info) => {
      if (info.id !== id) {
        return info;
      }
      return {
        ...info,
        active: false,
      };
    }));
    setDisplayedUploadElements((c) => c - 1);
  }, []);

  const closeFileUploadElement = useCallback((id) => {
    setFileInfos((oldInfos) => oldInfos.filter((info) => info.id !== id));
  }, []);

  useLayoutEffect(() => {
    if (maxFiles - displayedUploadElements > 0) {
      if (inputButtonState > 1) {
        setInputButtonState(0);
      }
    } else if (inputButtonState < 2) {
      setInputButtonState(2);
    }
  }, [maxFiles, displayedUploadElements, inputButtonState]);

  useEffect(() => {
    if (inputButtonState === 0) {
      requestAnimationFrame(() => {
        setInputButtonState(1);
      });
    }
  }, [inputButtonState]);

  const inputButtonStyle = {
    width: inputButtonState === 1 ? 24 : 0,
    transition: 'width 200ms ease-in-out',
    padding: 0,
    overflow: 'hidden',
  };

  return (
    <>
      {fileInfos.map(({ id, file, active, completion }) => (
        <FileUploadElement
          key={id}
          id={id}
          file={file}
          active={active}
          completion={completion}
          close={closeFileUploadElement}
          removeFile={removeFile}
          minHeight={minHeight}
        />
      ))}
      {inputButtonState !== 3 && (
        <div
          style={inputButtonStyle}
          onTransitionEnd={inputButtonState !== 2 ? undefined
            : () => setInputButtonState(3)}
        >
          <button
            key="ipt"
            type="button"
            style={{ width: '100%', height: '100%' }}
            className="fileupload"
            tabIndex={0}
            title={t`Attach File`}
            onClick={handleInputClick}
          >
            <ImAttachment />
          </button>
          <input
            key="fi"
            ref={inputRef}
            type="file"
            accept={acceptedTypes}
            onChange={handleInputChange}
            style={{
              position: 'absolute',
              opacity: 0,
              width: 0,
              height: 0,
            }}
          />
        </div>
      )}
    </>
  );
};

export default React.memo(FileUpload);
