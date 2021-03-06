import { Location } from 'my-router-history';
/**
 * MyRouter类
 * @interface MyRouter
 */
export interface MyRouter {
    /**
     * 路由模块当前的模式，目前仅提供浏览器模式，未来会提供
     * @type {string}
     * @memberOf MyRouter
     */
    readonly mode: string;
    /**
     * 当前的路由实例
     * @type {Location}
     * @memberOf MyRouter
     */
    readonly currentRoute: Location;
    /**
     * 缓存的路由队列
     * @type {Location[]}
     * @memberOf MyRouter
     */
    readonly routeStack: Location[];
    /**
     * 前进去往一个页面，名字取自history.push，他可返回的是一个promise，当页面返回到当前页面，他能把backValue的返回值返回
     * @param {string} path                 去往的地址
     * @param {*} [sessionData]             session数据
     * @param {*} [state]                   跳转的数据，要求可以被JSON.stringify
     * @returns {Promise<any>}
     *
     * @memberOf MyRouter
     */
    push(path: string, sessionData?: any, state?: any): Promise<any>;
    /**
     * 用一个URL代替当前的URL，跳转不产生历史记录，名字取自history.replace
     * @param {string} path                 去往的地址
     * @param {*} [sessionData]             session数据
     * @param {*} state                   跳转的数据，要求可以被JSON.stringify
     * @returns {Promise<void>}         回调的promise
     * @memberOf MyRouter
     */
    replace(path: string, sessionData?: any, state?: any): Promise<void>;
    /**
     * 向后回退。如果退回步数，超过了栈的长度，按照栈的长度算，名字取自history.goback
     * @param {number} n                    退回的步数
     * @returns {Promise<void>}        跳转完成的promise，并返回新创建的ILocation
     * @memberOf MyRouter
     */
    goback(n?: number): Promise<void>;
    /**
     * 退回到指定的path，如果为找到合适path，跳回到root
     * @param {string} path                 指定的path
     * @returns {Promise<void>}        跳转完成的promise，并返回新创建的ILocation
     * @memberOf IHistory
     */
    goback(path: string): Promise<void>;
    /**
     * 退回到符合条件的location，如果为找到合适path，跳回到root
     * @param {(fn: ReadonlgLocation)=>boolean} fn      条件函数
     * @returns {Promise<void>}        跳转完成的promise，并返回新创建的ILocation
     * @memberOf IHistory
     */
    goback(fn: (fn: Location) => boolean): Promise<void>;
    /**
     * 刷新当前页面，名字取自location.reload
     * @returns {Promise<void>}        跳转完成的promise，并返回新创建的ILocation
     * @memberOf IHistory
     */
    reload(): Promise<void>;
    /**
     * 增加一组MyRouteConfig
     * @param {MyRouteConfig[]} routes
     * @memberOf MyRouter
     */
    addRoutes(routes: MyRouteConfig[]): void;
    /**
     * 增加MyRouteConfig配置
     * @param {MyRouteConfig} routes
     * @memberOf MyRouter
     */
    addRoute(routes: MyRouteConfig): void;
    /**
     *
     * @param {String} url
     * @returns {any[]}
     * @memberOf MyRouter
     */
    getMatchedComponents(url: String): any[];
    /**
     *
     * @param {*} adapter
     * @memberOf IMyRouter
     */
    getAdapterInstance<T>(adapter: Adapter): T;
}
/**
 * 一个适配器，将my-router转换为其他类库的API，如vue-router、react-router。这样方便用my-router兼容其他项目
 * @interface Adapter
 */
export interface Adapter {
}
/**
 * 创建MyRouter的配置
 * @export
 * @interface MyRouterOptions
 */
export interface MyRouterOptions {
    routes?: MyRouteConfig[];
    precisionMatch?: boolean;
    mode?: string;
    base?: string;
    gobackName?: string;
}
/**
 *
 * @interface MyRouter
 */
export interface MyRouteConfig {
    /**
     * 映射的路径
     * @type {string}
     * @memberOf MyRouteConfig
     */
    path: string;
    /**
     * 映射的名字
     * @type {string}
     * @memberOf MyRouteConfig
     */
    name?: string;
    /**
     * 对应的控件
     * @type {*}
     * @memberOf MyRouteConfig
     */
    component?: any;
    /**
     * 如果多个并列的视图，可以使用components配置
     * @type {{[name: string]: any}}
     * @memberOf MyRouteConfig
     */
    components?: {
        [name: string]: any;
    };
    /**
     * 重定向到某个路由
     * @type {(string | {(): string})}
     * @memberOf MyRouteConfig
     */
    redirect?: string | {
        (): string;
    };
    /**
     * ？？？？
     * @type {(string | string[])}
     * @memberOf MyRouteConfig
     */
    alias?: string | string[];
    /**
     * 路由嵌套时候，可以注册子路由
     * @type {MyRouteConfig[]}
     * @memberOf MyRouteConfig
     */
    children?: MyRouteConfig[];
    /**
     * 用户自定义配置
     * @type {*}
     * @memberOf MyRouteConfig
     */
    meta?: any;
    /**
     * 匹配规则是否大小写敏感
     * @type {boolean}
     * @memberOf MyRouteConfig
     */
    caseSensitive?: boolean;
    /**
     * 页面的缓存模式:
     * standard： 标准模式，多实例，每一个href对应一个Component实例
     * single：单实例，仅创建一次，如果压入栈中，下次再打开这个Component时候，会取出来，复用之前的实例
     * singleCache：与single相同，也是单实例。不同是即使Component出栈也不释放，再次入栈时会把缓存的实例放入
     * @type {('standard' | 'single' | 'singleCache')}
     * @memberOf MyRouteConfig
     */
    lunchMode: 'standard' | 'single' | 'singleCache';
}
export { Location };
/**
 * 一个URL匹配工具，系统默认会使用path-to-regexp实现，但是用户可以根据自己需要，定制化path-to-regexp
 * @interface IPathRegexp
 */
export interface IPathRegexp {
    /**
     * 增加MyRouteConfig配置
     * @param {MyRouteConfig} route
     * @memberOf IPathRegexp
     */
    addRoute(route: MyRouteConfig): void;
    /**
     * 增加一组MyRouteConfig配置
     * @param {MyRouteConfig[]} route
     * @memberOf IPathRegexp
     */
    addRoutes(route: MyRouteConfig[]): void;
    /**
     * 根据精准匹配程度排序
     */
    precisionMatch(): any;
    /**
     * 根据URL获取匹配的route，并从URL中解析出URL参数
     * @param {string} url
     * @returns {PathRegexpResult}
     * @memberOf IPathRegexp
     */
    recognize(url: string): PathRegexpResult;
}
/**
 * 使用PathRegexp匹配的url后的结构
 * @interface PathRegexpResult
 */
export interface PathRegexpResult {
    /**
     * url解析出的query数据，例如a?b=c，解析结果是 {b: 'c'}。
     */
    queryData: {
        [name: string]: string | string[];
    };
    /**
     * url解析出的path数据，如path是/:id1/:id2，url是/a/b，解析结果是{id1: 'a', id2: 'b'}
     */
    pathData: {
        [name: string]: string;
    };
    /**
     * 匹配给定的url的RrouteConfig信息
     */
    routeConfig: MyRouteConfig;
    /**
     * 如果某个子MyRouteConfig匹配，将由子到父排序，依次保存在这个数组中
     */
    routeConfigPath: MyRouteConfig[];
    /**
     * 用于匹配的url
     */
    url: string;
}
