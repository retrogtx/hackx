"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  createdAt: string;
}

export default function KnowledgeBasePage() {
  const params = useParams();
  const pluginId = params.id as string;
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadDocs = useCallback(async () => {
    const res = await fetch(`/api/plugins/${pluginId}/documents`);
    if (res.ok) setDocs(await res.json());
  }, [pluginId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function handleFileUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setUploading(true);
    setError("");

    const form = new FormData(formEl);
    try {
      const res = await fetch(`/api/plugins/${pluginId}/documents`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      await loadDocs();
      formEl.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleTextUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setUploading(true);
    setError("");

    const formData = new FormData(formEl);
    try {
      const res = await fetch(`/api/plugins/${pluginId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      await loadDocs();
      formEl.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!window.confirm("Delete this document? This will remove all its chunks and embeddings. This cannot be undone.")) {
      return;
    }
    setError("");
    try {
      const res = await fetch(`/api/plugins/${pluginId}/documents?docId=${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete document");
      }
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }

  return (
    <div>
      <Link
        href={`/plugins/${pluginId}`}
        className="mb-4 inline-flex items-center text-sm text-[#666] transition-colors hover:text-white"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to plugin
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
        <p className="text-[#a1a1a1]">
          Upload documents that serve as your plugin&apos;s source of truth
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-[#262626] bg-[#0a0a0a]">
          <div className="border-b border-[#262626] p-6">
            <h2 className="font-bold text-white">Upload Content</h2>
            <p className="mt-1 text-sm text-[#a1a1a1]">
              Add documents or paste text to build your knowledge base. Content
              will be chunked and embedded automatically.
            </p>
          </div>
          <div className="p-6">
            <Tabs defaultValue="text">
              <TabsList className="mb-4 bg-[#1a1a1a] border border-[#262626]">
                <TabsTrigger value="text" className="data-[state=active]:bg-[#262626] data-[state=active]:text-white text-[#a1a1a1]">Paste Text</TabsTrigger>
                <TabsTrigger value="file" className="data-[state=active]:bg-[#262626] data-[state=active]:text-white text-[#a1a1a1]">Upload File</TabsTrigger>
              </TabsList>

              <TabsContent value="text">
                <form onSubmit={handleTextUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fileName" className="text-[#ededed]">Document Name</Label>
                    <Input
                      id="fileName"
                      name="fileName"
                      placeholder="e.g., IS 456:2000 - Table 16"
                      required
                      className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text" className="text-[#ededed]">Content</Label>
                    <Textarea
                      id="text"
                      name="text"
                      placeholder="Paste your document content, standard text, or reference material here..."
                      rows={10}
                      required
                      className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
                    />
                  </div>
                  <input type="hidden" name="fileType" value="markdown" />
                  <Button type="submit" disabled={uploading} className="bg-white text-black hover:bg-[#ccc] font-semibold">
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload &amp; Embed
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="file">
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file" className="text-[#ededed]">File</Label>
                    <Input
                      id="file"
                      name="file"
                      type="file"
                      accept=".txt,.md,.csv,.json"
                      className="border-[#262626] bg-[#111111] text-white file:text-[#a1a1a1] file:border-0 file:bg-transparent focus:border-[#444] focus:ring-0"
                    />
                    <p className="text-xs text-[#666]">
                      Supports .txt, .md, .csv, .json files
                    </p>
                  </div>
                  <Button type="submit" disabled={uploading} className="bg-white text-black hover:bg-[#ccc] font-semibold">
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload &amp; Embed
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && (
              <p className="mt-4 text-sm text-[#ff4444]">{error}</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-[#262626] bg-[#0a0a0a]">
          <div className="border-b border-[#262626] p-6">
            <h2 className="font-bold text-white">Documents</h2>
            <p className="mt-1 text-sm text-[#a1a1a1]">
              {docs.length} document{docs.length !== 1 ? "s" : ""} in knowledge base
            </p>
          </div>
          <div className="p-6">
            {docs.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <FileText className="mb-3 h-10 w-10 text-[#333]" />
                <p className="text-sm text-[#a1a1a1]">
                  No documents yet. Upload content to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-[#262626] bg-[#111111] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-[#666]" />
                      <div>
                        <p className="text-sm font-semibold text-white">{doc.fileName}</p>
                        <Badge variant="outline" className="mt-1 border-[#333] text-xs text-[#888]">
                          {doc.fileType}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      className="text-[#666] hover:text-[#ff4444] hover:bg-[#ff4444]/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
