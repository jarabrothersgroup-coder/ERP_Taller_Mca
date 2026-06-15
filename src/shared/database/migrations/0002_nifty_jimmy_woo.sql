CREATE INDEX "ingresos_vehicle_id_idx" ON "ingresos" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "ingresos_orden_trabajo_id_idx" ON "ingresos" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "ingresos_fecha_ingreso_idx" ON "ingresos" USING btree ("fecha_ingreso");--> statement-breakpoint
CREATE INDEX "ordenes_trabajo_vehicle_id_idx" ON "ordenes_trabajo" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "ordenes_trabajo_client_id_idx" ON "ordenes_trabajo" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "ordenes_trabajo_status_idx" ON "ordenes_trabajo" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trabajos_terceros_orden_trabajo_id_idx" ON "trabajos_terceros" USING btree ("orden_trabajo_id");--> statement-breakpoint
CREATE INDEX "trabajos_terceros_proveedor_idx" ON "trabajos_terceros" USING btree ("proveedor");--> statement-breakpoint
CREATE INDEX "vehiculos_client_id_idx" ON "vehiculos" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "vehiculos_plate_idx" ON "vehiculos" USING btree ("plate");--> statement-breakpoint
CREATE INDEX "vehiculos_vin_idx" ON "vehiculos" USING btree ("vin");