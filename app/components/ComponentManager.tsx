"use client";

import { useState, useEffect } from "react";
import { LocalizationDB, ComponentEntry } from "../lib/database";
import ComponentPreview from "./ComponentPreview";

export default function ComponentManager() {
  const [components, setComponents] = useState<ComponentEntry[]>([]);
  const [selectedComponent, setSelectedComponent] =
    useState<ComponentEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Load components on mount
  useEffect(() => {
    loadComponents();
  }, []);

  const loadComponents = async () => {
    setIsLoading(true);
    try {
      const db = LocalizationDB.getInstance();
      const allComponents = await db.getAllComponents();
      setComponents(allComponents);
    } catch (error) {
      console.error("Error loading components:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteComponent = async (id: string) => {
    if (!confirm("Are you sure you want to delete this component?")) return;

    try {
      const db = LocalizationDB.getInstance();
      await db.deleteComponent(id);

      // Refresh list and clear selection if deleted component was selected
      setComponents((prev) => prev.filter((c) => c.id !== id));
      if (selectedComponent?.id === id) {
        setSelectedComponent(null);
      }
    } catch (error) {
      console.error("Error deleting component:", error);
    }
  };

  const filteredComponents = components.filter(
    (component) =>
      component.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      component.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex">
      {/* Component List */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            Saved Components ({components.length})
          </h2>

          {/* Search */}
          <input
            type="text"
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     text-gray-900 dark:text-white bg-white dark:bg-gray-800 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              Loading components...
            </div>
          ) : filteredComponents.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm
                ? "No components match your search"
                : "No components created yet"}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredComponents.map((component) => (
                <div
                  key={component.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedComponent?.id === component.id
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => setSelectedComponent(component)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {component.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {component.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{component.extracted_keys.length} keys</span>
                        <span>
                          {new Date(
                            component.created_at || ""
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteComponent(component.id);
                      }}
                      className="ml-2 p-1 text-red-500 hover:text-red-700 transition-colors"
                      title="Delete component"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Component Details */}
      <div className="flex-1 flex flex-col">
        {selectedComponent ? (
          <>
            {/* Component Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedComponent.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {selectedComponent.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>
                    Created:{" "}
                    {new Date(
                      selectedComponent.created_at || ""
                    ).toLocaleDateString()}
                  </span>
                  {selectedComponent.updated_at !==
                    selectedComponent.created_at && (
                    <span>
                      • Updated:{" "}
                      {new Date(
                        selectedComponent.updated_at || ""
                      ).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Translation Keys */}
              {selectedComponent.extracted_keys.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Translation Keys ({selectedComponent.extracted_keys.length}
                    ):
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedComponent.extracted_keys.map((key) => (
                      <span
                        key={key}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Component Preview */}
            <div className="flex-1">
              <ComponentPreview componentCode={selectedComponent.code} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Select a Component
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Choose a component from the list to view its details and preview
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
