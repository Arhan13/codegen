"use client";

import { useState } from "react";
import SideNav from "./components/SideNav";
import Editor from "./components/Editor";
import LocalizationTable from "./components/LocalizationTable";
import ComponentManager from "./components/ComponentManager";

export default function Home() {
  const [currentPage, setCurrentPage] = useState<
    "editor" | "localization" | "components"
  >("editor");

  return (
    <div className="flex h-screen">
      <SideNav currentPage={currentPage} onPageChange={setCurrentPage} />

      <main className="flex-1 ml-64">
        {currentPage === "editor" && <Editor />}
        {currentPage === "localization" && <LocalizationTable />}
        {currentPage === "components" && <ComponentManager />}
      </main>
    </div>
  );
}
