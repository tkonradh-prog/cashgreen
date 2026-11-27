'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Category, CategoryType } from '@/lib/types';
import { CATEGORY_ICON_CHOICES, CategoryIcon } from './IconMap';
import { CustomInput } from './CustomInput';

const COLOR_SWATCHES = ['#ffffff', '#94a3b8', '#d4af37', '#3b82f6', '#818cf8', '#38bdf8', '#f87171'];

interface CategoryPickerProps {
  categories: Category[];
  type: CategoryType;
  value: string;
  onChange: (categoryId: string) => void;
  onCreateCategory?: (cat: Omit<Category, 'id'>) => Category;
}

export function CategoryPicker({
  categories,
  type,
  value,
  onChange,
  onCreateCategory,
}: CategoryPickerProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('shopping-bag');
  const [newColor, setNewColor] = useState('#ffffff');

  const matching = categories.filter((c) => c.type === type);

  const handleSaveNew = () => {
    const trimmed = newName.trim();
    if (!trimmed || !onCreateCategory) return;
    const created = onCreateCategory({
      name: trimmed,
      type,
      icon: newIcon,
      color: newColor,
    });
    onChange(created.id);
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-neutral-400">Kategoria</span>
        {onCreateCategory && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-white hover:text-neutral-300 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nowa kategoria
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {matching.map((cat) => {
          const active = cat.id === value;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(cat.id)}
              className={`group flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left border transition-all duration-150 active:scale-[0.96] cursor-pointer ${
                active
                  ? 'bg-white/95 text-black font-semibold border-white shadow-[0_4px_16px_rgba(255,255,255,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]'
                  : 'ios-glass-inset hover:bg-white/[0.08] hover:border-white/20 text-neutral-200'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                  active ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                }`}
              >
                <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-medium truncate">{cat.name}</span>
            </button>
          );
        })}
      </div>

      {creating && (
        <div className="mt-1 rounded-2xl bg-[#0f1218] border border-[#232a3a] p-4 space-y-3.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">
              Dodaj nową kategorię
            </span>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <CustomInput
            label="Nazwa kategorii"
            placeholder="np. Kawiarnie, Subskrypcje..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />

          <div>
            <span className="text-[11px] font-semibold text-neutral-400 mb-1.5 block">
              Wybierz ikonę
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_ICON_CHOICES.map((ic) => (
                <button
                  key={ic.key}
                  type="button"
                  onClick={() => setNewIcon(ic.key)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    newIcon === ic.key
                      ? 'bg-white text-black border-white'
                      : 'bg-[#151922] text-neutral-400 border-[#232a3a] hover:text-white'
                  }`}
                >
                  <CategoryIcon name={ic.key} className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-neutral-400 mb-1.5 block">
              Kolor akcentu
            </span>
            <div className="flex items-center gap-2">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setNewColor(swatch)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                    newColor === swatch ? 'scale-125 border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleSaveNew}
              disabled={!newName.trim()}
              className="px-4 py-1.5 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-50 text-black text-xs font-bold transition-all cursor-pointer"
            >
              Zapisz kategorię
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
