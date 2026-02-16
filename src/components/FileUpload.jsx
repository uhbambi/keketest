/*
 * Component to upload files
 */
import React, {
  useEffect, useState, useCallback, useRef,
} from 'react';

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
  // callback to print errors, gets array of error messages
  printErrors,
  // ref that we define a function on, that the parent calls when all should
  // be uploaded
  uploadRef,
}) => {
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

    console.log('selected files', files[0], files.length, files);
    if (!files.length) {
      return;
    }
    console.log('wtf1');

    if (uploadInfoRef.current[timeoutName]) {
      clearTimeout(uploadInfoRef.current[timeoutName]);
      uploadInfoRef.current[timeoutName] = null;
    }
    console.log('wtf2');

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
    console.log('wtf3');

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
    console.log(response);
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
      /* trigger upload of the rest */
      await uploadFile();
      /* wait for running uploads */
      await Promise.all(uploadInfoRef.current.uploads.map((i) => i.promise));

      const finishedFileInfos = [];
      for (let i = 0; i < fileInfos.length; i += 1) {
        const { fileInfo } = fileInfos[i];
        if (fileInfo) {
          finishedFileInfos.push(fileInfo);
        }
      }
      setFileInfos([]);

      return finishedFileInfos;
    };
  }, [uploadRef, uploadFile, fileInfos]);

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
  }, []);

  const closeFileUploadElement = useCallback((id) => {
    setFileInfos((oldInfos) => oldInfos.filter((info) => info.id !== id));
  }, []);

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
        />
      ))}
      {(maxFiles - fileInfos.length > 0) && (
        <>
          <button
            key="ipt"
            type="button"
            className="fileupload"
            tabIndex={0}
            onClick={handleInputClick}
          >
            <span key="si">📎</span>
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
        </>
      )}
    </>
  );
};

export default React.memo(FileUpload);
