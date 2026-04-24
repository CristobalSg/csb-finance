import { useEffect, useState } from "react";

import { addFileRecord, deleteFileRecord, getFilesBySubject } from "../lib/files-db";
import { createId } from "../lib/id";
import type { StoredFileItem } from "../types";

export const useSubjectFiles = (subjectId: string | null) => {
  const [files, setFiles] = useState<StoredFileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!subjectId) {
      setFiles([]);
      return;
    }

    setIsLoading(true);

    getFilesBySubject(subjectId)
      .then((result) => {
        if (isMounted) {
          setFiles(result.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
        }
      })
      .catch(() => {
        if (isMounted) {
          setFiles([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [subjectId]);

  const uploadFiles = async (fileList: FileList | File[]) => {
    if (!subjectId) {
      return;
    }

    const candidates = Array.from(fileList);
    const nextFiles: StoredFileItem[] = [];

    for (const file of candidates) {
      const record: StoredFileItem = {
        id: createId(),
        subjectId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: "",
        file,
        uploadedAt: new Date().toISOString(),
      };

      try {
        await addFileRecord(record);
        nextFiles.push(record);
      } catch {
        return;
      }
    }

    setFiles((current) =>
      [...nextFiles, ...current].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()),
    );
  };

  const removeFile = async (id: string) => {
    try {
      await deleteFileRecord(id);
    } catch {
      return;
    }

    setFiles((current) => current.filter((item) => item.id !== id));
  };

  return { files, isLoading, uploadFiles, removeFile };
};
