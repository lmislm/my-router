import { ILocation } from './model/ILocation';
/**
 * 增加'/'到path
 * @export
 * @param {string} path
 * @returns {string}
 */
export declare function addLeadingSlash(path: string): string;
/**
 * 移除path的根'/'
 * @export
 * @param {string} path
 * @returns {string}
 */
export declare function stripLeadingSlash(path: string): string;
/**
 * 移除path最后的'/'
 * @export
 * @param {string} path
 * @returns {string}
 */
export declare function stripTrailingSlash(path: string): string;
/**
 * 将一个path转为location对象形式
 * @export
 * @param {string} path
 * @returns {ILocation}
 */
export declare function parsePath(path: string): ILocation;
/**
 * 将一个location对象转为path对象
 * @export
 * @param {ILocation} location
 * @returns {string}
 */
export declare function createPath(location: ILocation): string;
