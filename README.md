
# my-router

在服务器端，路由是指根据请求的URL，将一个请求分发到对应的应用处理程序。因为可以通过URL确定一个页面，路由概念慢慢渗透到客户端，现在连安卓和ios开发都会有路由的概念。


## webapp的路由和app的路由的不同

提起webapp路由，大家会很自然地和浏览器的地址栏联系起来，因为地址栏可以输入编辑页面的URL，而路由又是抽象URL的产物。尽管为了充分模拟，webapp可以采用单页方案（SPA），可以使用hash和pushState无刷新改变URL。

||webapp路由|其他路由|
|----|----|----|
|用户是否可以主动刷新|能|不能|
|可以监听用户返回操作|不能|能|
|...|||

## my-router

my-router设计的目的就是寻找一套webapp和app一样的路由系统，my-router试图进一步抽象history对象和location对象，将其封装为一个类似app路由的，不再提供history对象和location对象，而是进行更进一步的路由抽象。从而使得我们的webapp表现形式更像app。



