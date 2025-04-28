/* eslint-disable @typescript-eslint/no-empty-object-type,@typescript-eslint/no-extraneous-class */
import { InjectionToken } from "@needle-di/core";

export const LOGGER = new InjectionToken<Logger>("LOGGER");

export interface Logger {}

export class MyLogger implements Logger {}
export class OtherLogger implements Logger {}
export class FileLogger implements Logger {}
