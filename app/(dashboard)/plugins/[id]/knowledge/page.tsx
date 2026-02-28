"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    await fetch(`/api/plugins/${pluginId}/documents?docId=${docId}`, {
      method: "DELETE",
    });
    await loadDocs();
  }

  return (
    <div>
      <Link
        href={`/plugins/${pluginId}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to plugin
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Upload documents that serve as your plugin&apos;s source of truth
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload Content</CardTitle>
            <CardDescription>
              Add documents or paste text to build your knowledge base. Content
              will be chunked and embedded automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="text">
              <TabsList className="mb-4">
                <TabsTrigger value="text">Paste Text</TabsTrigger>
                <TabsTrigger value="file">Upload File</TabsTrigger>
              </TabsList>

              <TabsContent value="text">
                <form onSubmit={handleTextUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fileName">Document Name</Label>
                    <Input
                      id="fileName"
                      name="fileName"
                      placeholder="e.g., IS 456:2000 - Table 16"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text">Content</Label>
                    <Textarea
                      id="text"
                      name="text"
                      placeholder="Paste your document content, standard text, or reference material here..."
                      rows={10}
                      required
                    />
                  </div>
                  <input type="hidden" name="fileType" value="markdown" />
                  <Button type="submit" disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload & Embed
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="file">
                <form onSubmit={handleFileUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="file">File</Label>
                    <Input
                      id="file"
                      name="file"
                      type="file"
                      accept=".txt,.md,.csv,.json"
                    />
                    <p className="text-xs text-muted-foreground">
                      Supports .txt, .md, .csv, .json files
                    </p>
                  </div>
                  <Button type="submit" disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload & Embed
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {error && (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              {docs.length} document{docs.length !== 1 ? "s" : ""} in knowledge base
            </CardDescription>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No documents yet. Upload content to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.fileName}</p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {doc.fileType}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
