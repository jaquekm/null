"use client";

import { useState } from "react";
import type { ItemDetail } from "../queries";
import { PropertiesPanel } from "./properties-panel";
import { TitleEditor } from "./title-editor";

export function ItemEditor({ item }: { item: ItemDetail }) {
  const [updatedAt, setUpdatedAt] = useState(item.updatedAt);

  return (
    <div className="flex flex-col gap-4">
      <TitleEditor itemId={item.id} initialTitle={item.title} updatedAt={updatedAt} onSaved={setUpdatedAt} />
      {item.type && (
        <PropertiesPanel
          itemId={item.id}
          fields={item.type.fields}
          properties={item.properties}
          updatedAt={updatedAt}
          onSaved={setUpdatedAt}
        />
      )}
    </div>
  );
}
