declare module "@dnd-kit/core" {
  import type { ReactNode, CSSProperties } from "react";

  export interface DragStartEvent {
    active: { id: string | number };
  }

  export interface DragEndEvent {
    active: { id: string | number };
    over: { id: string | number } | null;
  }

  export interface DragOverEvent {
    active: { id: string | number };
    over: { id: string | number } | null;
  }

  export interface SensorOptions {
    activationConstraint?: {
      distance?: number;
      delay?: number;
      tolerance?: number;
    };
  }

  export interface SensorInstance {
    sensor: any;
    options: SensorOptions;
  }

  export function useSensor<T>(sensor: T, options?: SensorOptions): SensorInstance;
  export function useSensors(...sensors: SensorInstance[]): SensorInstance[];

  export function useDraggable(options: {
    id: string | number;
    data?: Record<string, any>;
  }): {
    attributes: Record<string, any>;
    listeners: Record<string, any>;
    setNodeRef: (node: HTMLElement | null) => void;
    transform: { x: number; y: number } | null;
    isDragging: boolean;
  };

  export function useDroppable(options: {
    id: string | number;
    data?: Record<string, any>;
  }): {
    setNodeRef: (node: HTMLElement | null) => void;
    isOver: boolean;
    over: { id: string | number } | null;
  };

  export const closestCenter: any;
  export const DndContext: React.ComponentType<{
    sensors?: SensorInstance[];
    collisionDetection?: any;
    onDragStart?: (event: DragStartEvent) => void;
    onDragEnd?: (event: DragEndEvent) => void;
    onDragOver?: (event: DragOverEvent) => void;
    children?: ReactNode;
  }>;

  export const DragOverlay: React.ComponentType<{
    children?: ReactNode;
    dropAnimation?: any;
  }>;

  export const PointerSensor: any;
  export const TouchSensor: any;
}

declare module "@dnd-kit/sortable" {
  export function useSortable(options: {
    id: string | number;
    data?: Record<string, any>;
  }): {
    attributes: Record<string, any>;
    listeners: Record<string, any>;
    setNodeRef: (node: HTMLElement | null) => void;
    transform: { x: number; y: number } | null;
    transition: string;
    isDragging: boolean;
  };

  export const SortableContext: React.ComponentType<{
    items: (string | number)[];
    strategy?: any;
    children?: React.ReactNode;
  }>;

  export const verticalListSortingStrategy: any;
}

declare module "@dnd-kit/utilities" {
  export const CSS: {
    transform: (transform: { x: number; y: number; scaleX?: number; scaleY?: number } | null) => string;
  };
}
