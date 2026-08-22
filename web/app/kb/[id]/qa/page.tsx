"use client";

import { use } from "react";

import { QaPlayground } from "@/components/qa/QaPlayground";

export default function QaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: kbId } = use(params);
  return <QaPlayground kbId={kbId} />;
}
