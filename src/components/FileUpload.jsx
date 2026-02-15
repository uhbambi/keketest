/*
 * Component to upload files
 */
import React, {
  useEffect, useState, useCallback, useRef,
} from 'react';

import FileUploadElement from './FileUploadElement.jsx';
import { requestFileUpload } from '../store/actions/fetch.js';
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
   * completion is null when upload not started, -1 when upload failed,
   * 0-100 otherwise
   */
  const [fileInfos, setFileInfos] = useState([]);
  /*
   * object with informations of uploads
   * {
   *   uploads: [{
   *     controller: AbortController,
   *     promise,
   *     ids: Set<id>,
   *   }],
   *   timeout, // timeout for auto-upload
   *   incrId, // incrmeneting id for files
   *   unmounted, // boolean
   * }
   */
  const uploadInfoRef = useRef({
    timeout: null, incrId: 1, uploads: [], unmounted: false,
  });

  const inputRef = useRef(null);

  const handleInputClick = useCallback(() => {
    const inputElement = inputRef.current;
    if (!inputElement) {
      return;
    }
    // cancel scheduled uploads
    if (uploadInfoRef.current.timeout) {
      clearTimeout(uploadInfoRef.current.timeout);
      uploadInfoRef.current.timeout = null;
    }
    inputElement.click();
  }, []);

  const uploadFile = useCallback(async () => {
    const files = [];
    const ids = new Set();
    setFileInfos((oldInfos) => oldInfos.map((info) => {
      if (info.active && info.completion === null) {
        files.push(info.file);
        ids.add(info.id);
        return {
          ...info,
          completion: 0,
        };
      }
      return info;
    }));
    if (!files.length) {
      return;
    }

    if (uploadInfoRef.current.timeout) {
      clearTimeout(uploadInfoRef.current.timeout);
      uploadInfoRef.current.timeout = null;
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

    const response = await requestFileUpload(
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

    // if component is already unmounted, get out
    if (uploadInfoRef.current.unmounted === null) {
      resolvePromise();
      return;
    }

    if (response === null) {
      // aborted
      setFileInfos((oldInfos) => oldInfos.map((info) => {
        if (ids.has(info.id)) {
          return {
            ...info,
            completion: null,
          };
        }
        return info;
      }));
      resolvePromise();
      return;
    }

    const { availableFiles, errors } = response;
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
          id, file, active: true, completion: null,
        },
      ]);
      evt.target.value = '';
      // schedule upload
      if (uploadInfoRef.current.timeout) {
        clearTimeout(uploadInfoRef.current.timeout);
      }
      uploadInfoRef.current.timeout = setTimeout(uploadFile, 5000);
    }
  }, [uploadFile]);

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
    if (uploadInfoRef.current.timeout) {
      clearTimeout(uploadInfoRef.current.timeout);
      uploadInfoRef.current.timeout = null;
    }
    /*
      * null on this ref used to detect that component is unmounted
      */
    uploadInfoRef.current.unmounted = null;
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
