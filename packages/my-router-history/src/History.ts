import { History as IHistory, BeforeChangeEventCallback, ChangeEventCallback, Location, _Location, HistoryConfig } from './API';
import { createLocation } from './LocationUtils';
import { addLeadingSlash } from './PathUtils';
import { canUseDOM, nextTick } from './DOMUtils';
import { Deferred } from './Deferred';

const MY_ROUTER_HISTORY_GOBACK_INIT = 'MyRouterHistory:initGoback'
// 记录MyHistory在默认window上的实例数，确保constructor仅能够运行一个实例
const MY_ROUTER_HISTORY_WINDOW_INIT = 'MyRouterHistory:window'

let locationKey = Symbol('location')

export {
    Location,
    ChangeEventCallback
}

// 保存在history的state里面的路由信息，这个信息因为不会随着浏览器刷新而消失，因此时候保存location信息
interface State{
    // 当前的Location
    location: _Location
    // 当前的时间戳
    timeStamp: number
    // 页面的类型
    type: 'GOBACK' | 'NORMAL'
    // 用户缓存的数据
    data?: any
}

/**
 * 路由错误
 * @export
 * @interface HistoryError
 * @extends {Error}
 */
export interface HistoryError extends Error{
    /**
     * 用户取消，一般指在beforeChange钩子中，用户取消了跳转
     * @type {boolean}
     * @memberOf HistoryError
     */
    isCancelled?: boolean

    /**
     * 路由忙，无法响应请求。一般指路由处于非1状态，无法响应路由变化
     * @type {boolean}
     * @memberOf HistoryError
     */
    isBusy?: boolean
}


/**
 * 一个状态模式，每个状态的功能接口
 * @interface IHistoryState
 */
interface IHistoryState{
    type: number,
    push: IHistory['push']
    replace: IHistory['replace']
    goback: IHistory['goback']
    reload: IHistory['reload']
    hashChange(event: HashChangeEvent): void
}

/**
 * 用于mixin的基类
 */
let baseHistoryState: IHistoryState = {
    push: null,
    replace: null,
    goback: null,
    reload: null,
} as any

export class MyHistory implements IHistory {

    // 当前history的状态：
    // 0未初始化    history没有完成初始化的时候
    // 1正常        history正常运行中
    // 2修正中      当用户手动修改hash，会被视为一次用户触发的跳转。此次跳转会先退回到goback页面，再前进回跳转的页面（为了保持history在浏览器中仅有两个浏览器记录——当前页面和退回页面），这个过程我们叫修改中
    // 3返回中      当用户要求跳转回退，或者正在回退
    // 4销毁中      在history销毁过程中的状态。
    // 5退出中      当用户要求退出到系统以外，系统会一直触发goback，直到页面刷新为止
    // 6跳转中      当用户要求跳转（包括push、replace、reload）
    // 7跳转中      执行生命周期中
    private _state: IHistoryState = {
        ...baseHistoryState,
        type: 0,
        hashChange(){}
    };

    // state处于一些状态中，临时保存状态的过程数据的地方
    private _stateData: any;

    // 保存location数据的栈
    private _stateStack: State[] = []

    // goback页面的State
    private _gobackState: State

    get _stackTop(): State{
        if(this._stateStack.length){
            return this._stateStack[this._stateStack.length - 1]
        } else {
            return null
        }
    }

    constructor(private _config: HistoryConfig, _window: Window = window){
        this._win = _window
        if(this._win[MY_ROUTER_HISTORY_WINDOW_INIT]){
            // 同一时刻，在默认的window上面，不允许有两个history实例运行
            throw new Error('There are already other undestroyed history instances. Please destroy them before you can create a new history instance.')
        }

        this._config = {
            gobackName: 'go back',
            root: '/',
            insertRoot: true,
            ..._config
        }

        this._hashchangeHandler = this._hashchangeHandler.bind(this)

        this._initHistory()
    }

    // 浏览器history对应的window对象
    private _win: Window

    /**
     * 初始化goback的location
     * goback的location有2个作用：
     * 1.用于监听用户的返回事件，当用户点击地址栏的返回按钮，会退回到goback的location。由goback去处理用户注册的goback事件
     * 2.当用户手动修改浏览器的location的hash时候，history会增加一条location记录，这时候myhistory会先退回到goback的location，再前进到用户输入的lactation中，这样可以清除浏览器地址栏的前进按钮
     * @private
     * @param {number} now      初始化时候的时间戳
     * @returns {boolean}       是否是goback处于上一页。返回false表示当前就是goback页面。
     * @memberOf MyHistory
     */
    private _initGoback(now: number): boolean{
        // 先查看是否已经创建好了一个goback的location，因为浏览器中无法查看history对象里面保存的历史记录，所以使用history.state保存这个状态。

        // state里面用于记录当前是否处于goback的下一页。
        // 让goback比当前时间戳小，这样能够判断出是后退
        this._gobackState = this._pathToState('/goback', undefined, 'GOBACK', now - 1)

        let state = this._win.history.state
        if(state && (state as State).type === 'GOBACK' && sessionStorage[MY_ROUTER_HISTORY_GOBACK_INIT]){
            // 如果当前页面是goback，表示goback已经初始化完成
            return false
        } else if(state && (state as State).type === 'NORMAL' && sessionStorage[MY_ROUTER_HISTORY_GOBACK_INIT]){
            // 因为目前还处于goback页面，所有返回false
            return true
        } else {
            sessionStorage[MY_ROUTER_HISTORY_GOBACK_INIT] = true
            this._replaceState(this._gobackState)
            return false
        }
    }

    // 初始化URL
    private _initHistory(){

        // 创建hash路由
        if(!canUseDOM){
            throw new Error('Hash history needs a DOM')
        }

        // 获取当前时间戳
        let timeStamp = Date.now()

        // 获取当前的路径，将其转换为合法路径后，
        let initialPath = this._decodePath(this._getHrefToPath());
        let initialLocationState: State = this._pathToState(initialPath, undefined, 'NORMAL', timeStamp)

        // 初始化goback
        let isGobackNextLocation = this._initGoback(timeStamp)

        // 将当前路径压入栈中
        this._push(initialLocationState, !isGobackNextLocation)

        // 如果第一个节点不等于根的路径，插入根节点到栈底
        if(this._config.insertRoot && this._stackTop.location.href !== this._config.root){
            this._stateStack.unshift(this._pathToState(this._config.root, undefined, 'NORMAL', timeStamp))
        }

        // 初始化监听器
        this._initEventListener()

        // 全部初始化完成，记录初始化成功
        this._win[MY_ROUTER_HISTORY_WINDOW_INIT] = true

        this._switchState(1)

        // 使用微队列，用于异步初始化
        Promise.resolve()
        .then(()=>{
            let newState: Location = this._readonlyLocation(initialLocationState)
            this._execCallback(this.onChange)('init', null, newState, [], [newState])
        })
    }

    /**
     * 注册到HashChange事件的监听器。这个函数会在构造器中bind，以在addEventListener保持this不变
     * @private
     * @param {HashChangeEvent} event
     * @memberOf MyHistory
     */
    private _hashchangeHandler(event: HashChangeEvent){
        this._state.hashChange(event)
    }

    private _initEventListener(){
        // 注册
        this._win.addEventListener('hashchange', this._hashchangeHandler)
    }

    private _destroyEventListener(){
        this._win.removeEventListener('hashchange', this._hashchangeHandler)
    }

    /**
     * 如果在beforeChange生命周期，出现了跳转，会在路由重新回归1的时候执行。
     * 如果_notBusyDef已经存在，即使是在beforeChange生命周期（state为7）的时候，也不可以跳转
     * @private
     * @type {Deferred}
     * @memberOf MyHistory
     */
    private _notBusyDef: Deferred<void> = null

    /**
     * 切换状态
     * @private
     * @param {any} stateType
     * @memberOf MyHistory
     */
    private _switchState(stateType){

        // 处理beforeChange中的取消逻辑。如果用户返回false、Error、Function都视为取消跳转。其中Function会在跳转结束后自执行
        let handleCancell = function(result: boolean | void | Error | Function){

            let isFalse = result === false, isFunction = typeof result === 'function'
            if(isFalse || isFunction){
                // 这里用任务队列而不用微任务队列，希望整个promise执行完再执行result
                if(isFunction){
                    nextTick(()=>{
                        ;(result as Function).call(this)
                    })
                }

                // 抛出用户取消异常
                let error: HistoryError = new Error('User cancelled')
                error.isCancelled = true
                throw error
            } else if(result instanceof Error){
                throw result
            }
        }

        // 简单原型函数名，增加压缩效率
        let toReadonly: (state: State)=> Location = this._readonlyLocation.bind(this)

        switch(stateType){
            case(1):
                this._state = {
                    type: 1,
                    push: async (path: string, data?: any)=> {
                        this._checkData(data)

                        // 先切换到状态6，保护在跳转过程中不受其他操作影响
                        this._switchState(6)
                        try{
                            let state: State = this._pathToState(path, data, 'NORMAL')
                            let newLocation = toReadonly(state)
                            let oldLocation = toReadonly(this._stackTop)

                            let result = await (this._execCallback(this.onBeforeChange, true)('push', oldLocation, newLocation, [], [newLocation]))

                            // 处理取消情况
                            handleCancell(result)

                            this._push(state)

                            // 确保跳转完成
                            await new Promise(r=> nextTick(r))

                            await (this._execCallback(this.onChange)('push', oldLocation, newLocation, [], [newLocation]))
                            this._switchState(1)

                            return this._readonlyLocation(state)
                        } catch(e){
                            // 完成后切换状态1
                            this._switchState(1)
                            throw e
                        }
                    },
                    replace: async (path: string, data?: any)=> {
                        this._checkData(data)

                        this._switchState(6)
                        try{
                            let now = Date.now()
                            let state: State = this._pathToState(path, data, 'NORMAL', now)
                            let newLocation = toReadonly(state)
                            let oldLocation = toReadonly(this._stackTop)

                            let result = await (this._execCallback(this.onBeforeChange, true)('replace', oldLocation,
                            newLocation, [oldLocation], [newLocation]))

                            // 处理取消情况
                            handleCancell(result)

                            this._replace(state)

                            // 确保跳转完成
                            await new Promise(r=> nextTick(r))

                            this._switchState(1)
                            await this._execCallback(this.onChange)('replace', oldLocation, newLocation, [oldLocation], [newLocation])

                            return this._readonlyLocation(state)
                        } catch(e){
                            // 完成后切换状态1
                            this._switchState(1)
                            throw e
                        }
                    },
                    goback: async (n: number | string | {(fn: Readonly<Location>): boolean} = 1): Promise<Location>=>{

                        // 先执行生命周期
                        this._switchState(3)
                        try{
                            // 当前页面
                            let oldLocation: Location
                            // 丢弃的页面
                            let discardLoctions: Location[]
                            // 退回到的页面
                            let newState: State
                            // 新建页面
                            let newLocation: Location
                            // 是否有符合退回条件的页面，如果没有插入一条
                            let needInclude = false

                            // 判断是否符合页面的条件
                            let fn: {(fn: Location, index: number): boolean}

                            if(typeof n === 'number'){
                                // 如果退回的步数大于栈的长度，则给缓存插入一个根页面，让用户先退回到根页面
                                if(n <= 0){
                                    return null
                                } else if(n >= this._stateStack.length){
                                    fn = ()=> false
                                } else {
                                    fn = (location, index: number)=> this._stateStack.length - index - 1 === n
                                }
                            } else if(typeof n === 'string'){
                                // 查询有没有href等于n的页面，如果没有就退回到起点，然后插入一条记录
                                fn = (location)=> location.href === this._pathToLocation(n).href
                            } else if(typeof n === 'function'){
                                fn = n
                            }

                            let index = this._stateStack.findIndex((item, index)=>fn(toReadonly(item), index))
                            oldLocation = toReadonly(this._stackTop)
                            if(index === -1){

                                // 如果没有找到，就插入一条根节点进去。但是如果查询的是指定页面，就将指定页面放进去
                                newState = this._pathToState(this._pathToLocation(typeof n === 'string' ? n : this._config.root), 'NORMAL', undefined)
                                newLocation = toReadonly(newState)
                                discardLoctions = this._stateStack.map(item=> toReadonly(item))
                                needInclude = true
                            } else {
                                // 取出退回位置的state
                                newState = this._stateStack[index]
                                newLocation = toReadonly(newState)
                                discardLoctions = this._stateStack.slice(index + 1).map(item=> toReadonly(item)).reverse()
                            }

                            let result = await (this._execCallback(this.onBeforeChange, true)('goback', oldLocation, newLocation,
                                discardLoctions, needInclude ? [newLocation] : []))

                            // 处理取消情况
                            handleCancell(result)

                            this._goback(discardLoctions.length, needInclude ? newState : null, false)

                            // 确保跳转完成
                            await new Promise(r=> nextTick(r))

                            this._switchState(1)
                            await (this._execCallback(this.onChange)('goback', oldLocation, newLocation,
                                discardLoctions, needInclude ? [newLocation] : []))

                            return this._readonlyLocation(newState)
                        } catch(e){
                            // 完成后切换状态1
                            this._switchState(1)
                            throw e
                        }
                    },
                    reload: ()=>{
                        return this._state.replace(this._stackTop.location.href)
                    },
                    hashChange: (event)=>{
                        let state = this._win.history.state
                        if(state && (state as State).type === 'GOBACK'){
                            // 用户手动退回，前进一个页面，让history的修正
                            this._pushState(this._stackTop)
                            this._state.goback(1)

                        } else if(!state && this._getHrefToPath(event.oldURL) === this._stateStack[this._stateStack.length - 1].location.href){
                            // 判断是否是用户手动修改hash跳转，或者a标签切换hash。判断方法如下：
                            // 1.当前history没有state，或者state不等于State变量
                            // 2.oldURL等于当前_stateStack栈顶的href（即使这样也不能确定该页面是从系统页面栈顶跳转过来的，但是没有其他更好的方式）

                            // 先切户到手动修正用户修改url的状态2，保留用户要跳转的url
                            this._switchState(2)
                            this._stateData = this._getHrefToPath(event.newURL)

                            // 后退两次，退回到goback页面
                            this._win.history.go(-2)
                        } else {
                            // 如果不是从栈顶的url转跳转到该状态，就无法确定返回页面就在当前页面的前面，因此触发修正
                            this._correct()
                            // 纠正后重新后退
                            this._win.history.back()
                        }
                    }
                }
                // 重新置回1，设置_notBusyDef为resolve
                if(this._notBusyDef){
                    this._notBusyDef.resolve(undefined)
                    this._notBusyDef = null
                }
                break;
            case(2):
                this._state = {
                    type: 2,
                    ...baseHistoryState,
                    hashChange: (event)=>{
                        // 对纠正的处理步骤
                        // 1. 一直后退，直到后退到goback页面
                        // 2. 前进到gobackNext页面，把用户给出的地址放到gobackNext页面中。

                        let state = (this._win.history.state as State)
                        if(state && state.type === 'NORMAL'){
                            // 如果当前处于gobackNext页面，表示上一页就是goback，则退回，这主要是为了修改ios的safari那种无法使用go(-2)的浏览器时候的处理方式
                            this._win.history.back()
                        } else if(state && state.type === 'GOBACK'){
                            // 如果已经在goback页面了，则跳转到用户手输入的地址
                            let now = Date.now()
                            let location: _Location = this._pathToLocation(this._stateData, now)

                            // 切回正在状态，这样就完成了对页面的修正
                            this._switchState(1)
                            this._pushState(this._stackTop)
                            this._state.push(location.href)
                        } else {
                            // 在纠正的时候，如果跳转到了goback和gobackNext以外的页面，视为异常，进行异常纠正
                            this._correct()
                            // 纠正后重新后退
                            this._win.history.back()
                        }
                    }
                }
                break;
            case(3):
            case(6):
                this._state = {
                    type: stateType,
                    ...baseHistoryState,
                    hashChange: (event)=>{
                        if(!this._win.history.state && this._getHrefToPath(event.oldURL) === this._stateStack[this._stateStack.length - 1].location.href){
                            // 如果用户在此期间手动修改url，直接纠正
                            this._correct()
                        } else {
                            // 用户手动退回，前进一个页面，让history的修正
                            this._pushState(this._stackTop)
                        }
                    }
                }
                break;
            case(4):
            case(5):
                this._state = {
                    type: stateType,
                    ...baseHistoryState,
                    hashChange: (event)=>{
                        this._win.history.back()
                    }
                }
                break;
            case(7):
                this._state = {
                    type: stateType,
                    hashChange: (event)=>{
                        this._win.history.back()
                    },
                    push: async (path: string, state?: any)=> {
                        this._notBusyDef = new Deferred
                        return this._notBusyDef.promise.then(()=>{
                            return this.push(path, state)
                        })
                    },
                    replace: async (path: string, state?: any)=> {
                        this._notBusyDef = new Deferred
                        return this._notBusyDef.promise.then(()=>{
                            return this.replace(path, state)
                        })
                    },
                    goback: async (arg: any)=> {
                        this._notBusyDef = new Deferred
                        return this._notBusyDef.promise.then(()=>{
                            return this.goback(arg)
                        })
                    },
                    reload: async ()=> {
                        this._notBusyDef = new Deferred
                        return this._notBusyDef.promise.then(()=>{
                            return this.reload()
                        })
                    },
                }
                break;
        }
    }

    /**
     * 将用户给定的path转为系统显示的path
     * @private
     * @param {string} path         用户给定的path
     * @returns {string}            系统显示的path
     * @memberOf MyHistory
     */
    private _encodePath(path: string): string{
        return addLeadingSlash(path)
    }

    /**
     * 将系统显示的path转为用户给定的path
     * @private
     * @param {string} path         系统显示的path
     * @returns {string}            用户给定的path
     * @memberOf MyHistory
     */
    private _decodePath(path: string): string{
        return addLeadingSlash(path)
    }

    // 获取hash中保存的路径。
    private _getHrefToPath(href = this._win.location.href): string {
        // We can't use window.location.hash here because it's not
        // consistent across browsers - Firefox will pre-decode it!
        const hashIndex = href.indexOf('#');
        return hashIndex === -1 ? '' : href.substring(hashIndex + 1);
    }

    // 检查data，确保data可以序列化
    private _checkData(data) {
        if(data != null){
            JSON.stringify(data)
        }
    }

    // 检查路由是否处于可以跳转状态（state为1或7，如果处于7仅能跳转1次）
    checkBusy(){
        if(this.isBusy){
            let error: HistoryError = new Error('MyHistory busy')
            error.isBusy = true
            throw error
        }
    }

    /**
     * 将给定的path封装成一个location
     * @private
     * @param {string} path
     * @param {number} [timeStamp=Date.now()]
     * @returns
     * @memberOf MyHistory
     */
    private _pathToLocation(path: string, timeStamp: number = Date.now()): _Location {

        path = this._decodePath(path);

        // 创建的location
        return createLocation(path, timeStamp + '');
    }

    /**
     * 将给定的path封装成一个State
     * @private
     * @memberOf MyHistory
     */
    private _pathToState(location: _Location, data: any, type: State['type'], timeStamp?: number): State;
    private _pathToState(path: string, data: any, type: State['type'], timeStamp?: number): State;
    private _pathToState(path: _Location | string, data: any = null, type: State['type'], timeStamp?: number): State{

        let location: _Location

        if(typeof path === 'object'){
            location = path
        } else {
            location = this._pathToLocation(path, timeStamp)
        }

        return {
            location: location,
            type,
            timeStamp,
            data: JSON.parse(JSON.stringify(data))
        }
    }

    private _readonlyLocation(state: State): Location {
        let data = state.data
        let location = {
            ...state.location,
            state: data,
        }

        // 只读对象
        let readonlyLocation = {
            [locationKey]: location
        }

        // 通过只设置getter不设置setter实现只读。不使用freeze是因为freeze在严格模式下赋值会抛出错误。
        Object.keys(location).forEach((key)=>{
            Object.defineProperty(readonlyLocation, key, {
                get(){
                    return this[locationKey][key]
                },
                set(){
                },
                enumerable: true,
            })
        })

        return readonlyLocation as Location
    }

    private async _push(state: State, push = false){
        if(push){
            let tempTitle = this._win.document.title
            // 修改title为gobackName，这样地址栏显示的时候会是一个给定的gobackName，而不是页面的title
            this._win.document.title = this._config.gobackName
            this._pushState(state)
            this._win.document.title = tempTitle
        } else {
            this._replaceState(state)
        }
        this._stateStack.push(state)
    }

    private async _replace(state: State, push = false){
        this._stateStack.pop()
        this._stateStack.push(state)
        if(push){
            let tempTitle = this._win.document.title
            // 修改title为gobackName，这样地址栏显示的时候会是一个给定的gobackName，而不是页面的title
            this._win.document.title = this._config.gobackName
            this._pushState(state)
            this._win.document.title = tempTitle
        } else {
            this._replaceState(state)
        }
    }

    private _goback(n: number, state: State = null, push = false){
        if(n <= 0){
            return
        }
        this._stateStack.splice(Math.max(0, this._stateStack.length - n))

        if(state){
            this._stateStack.push(state)
        }

        let lastState = this._stateStack[this._stateStack.length - 1]
        if(push){
            this._pushState(lastState)
        } else {
            this._replaceState(lastState)
        }
    }

    _replaceState(state: State){
        this._win.history.replaceState(state, null, '#' + this._encodePath(state.location.href))
    }

    _pushState(state: State){
        this._win.history.pushState(state, null, '#' + this._encodePath(state.location.href))
    }

    /**
     * 当用处于未知页面（既不是goback页面，也不是normal页面时候），触发纠正
     */
    _correct(){
        // 暂时先记录日志
        console.error('异常', this._stateStack, this._win.history.state, location.hash)

        // 初始化goback
        let isGobackNextLocation = this._initGoback(this._gobackState.timeStamp)

        // 初始化当前页面
        this._push(this._stackTop, !isGobackNextLocation)
    }

    push(path: string, data?: any): Promise<Location>{
        this.checkBusy()
        return this._state.push(path, data)
    }

    replace(path: string, data?: any): Promise<Location>{
        this.checkBusy()
        return this._state.replace(path, data)
    }

    goback(n?: number | string | {(fn: Readonly<Location>): boolean}): Promise<Location>{
        this.checkBusy()
        return this._state.goback(n as any)
    }

    reload(): Promise<Location>{
        this.checkBusy()
        return this._state.reload()
    }

    async destroy(){
        this._destroyEventListener()
        this.onBeforeChange = null
        this.onChange = null

        if(this._notBusyDef){
            let error: HistoryError = new Error('User cancelled')
            error.isCancelled = true
            this._notBusyDef.reject(error)
            this._notBusyDef = null
        }

        sessionStorage[MY_ROUTER_HISTORY_GOBACK_INIT] = false

        let goGoBackPage = async ()=>{
            if(this._win.history.state && this._win.history.state.type === 'NORMAL'){
                this._win.history.back()
                await new Promise(r=> setTimeout(r, 50))
                await goGoBackPage()
            } else if(this._win.history.state){
                this._win.history.replaceState(null, null, '#' + this._stackTop.location.href)
                this._win.location.hash = '#' + this._stackTop.location.href
                await new Promise(r=> setTimeout(r, 50))
                await goGoBackPage()
            } else {
                await new Promise(r=> setTimeout(r, 50))
            }
        }
        await goGoBackPage()

        // 延时，等pushState执行完
        this._stateStack = null
        this._config = null
        this._stateData = null
        this._state = null
        if(this._win === window){
            delete this._win[MY_ROUTER_HISTORY_WINDOW_INIT]
        }
        this._win = null
    }

    get stack(){
        return this._stateStack.map(state=> this._readonlyLocation(state))
    }

    get length(){
        return this._stateStack.length
    }

    get isBusy(){
        return (this._state.type !== 1 && this._state.type !== 7) || !!(this._notBusyDef && this._state.type === 7)
    }

    get location(){
        return this._readonlyLocation(this._stackTop)
    }

    onBeforeChange: BeforeChangeEventCallback = null

    onChange: ChangeEventCallback = null

    _execCallback<T extends Function>(callback: T, isBeforeChange = false): T{
        if(typeof callback === 'function'){
            return (async (...args)=>{
                let state = this._state.type
                try{
                    if(!isBeforeChange){
                        this._switchState(7)
                    }
                    let result = await callback.apply(this, args)
                    this._switchState(state)
                    return result
                } catch(e){
                    this._switchState(state)
                    throw e
                }
            }) as any
        } else {
            return (()=>Promise.resolve()) as any
        }
    }
}
