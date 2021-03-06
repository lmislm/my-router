<doc>
    <h1>my-router-history</h1>

    <p><strong>my-router-history</strong>是<a href="https://github.com/laden666666/my-router">my-router</a>的一个子项目，旨在用于浏览器上实现高仿APP式的单页面路由。<strong>my-router-history</strong>屏蔽了浏览器的诸多行为：记录用户历史记录、前进按钮等，并监听用户返回动作，使得WebApp路由变得更像App。可用于PWA路由开发、WebApp路由开发、微信小程序路由移植等场景。</p>

    <h2>主要功能</h2>

    <p><strong>my-router-history</strong>的主要功能如下：</p>
    <h3>增加返回页面</h3>
    <p><strong>my-router-history</strong>会在用户进入Web页面后，插入一个专门监听返回行为的页面。如下图用户进入网页后后，会自动地增加一条名为“返回”的浏览记录。</p>
    <img src="./doc-jsx/GIF.gif" alt=""/>

    <h3>用户跳转页面后，不产生浏览记录</h3>
    <p>浏览器的地址栏会收集用户的浏览记录，<strong>my-router-history</strong>屏蔽了这一行为。因为App会试图用自己的导航去引导用户，而历史记录会让用户跳出App精心设计的导航，使得工作流变得混乱，用户体验变得更差。</p>
    
    <p>如下图，用户在地址栏输入地址“/demo”后，页面跳转，但是浏览器中仅存在“返回”一条记录，看不到“首页”记录。</p>
    <img src="./doc-jsx/GIF2.gif" alt=""/>

    <h3>禁用地址栏的前进按钮</h3>
    <p>浏览器中，用户返回上一页后，地址栏的“前进按钮”就会变为可点击状态，用户点击“前进按钮”会回到之前的页面。而<strong>my-router-history</strong>屏蔽了这一行为，因为“前进按钮”在App中也是没有的。如下图，用户点击返回后，前进按钮仍然是不可用状态。</p>

    <p>如下图，用户后退后，前进页面仍不可点。</p>
    <img src="./doc-jsx/GIF3.gif" alt=""/>

    <h2>其他功能</h2>
    <h3>虚拟历史记录</h3>
    <p>浏览器地址栏的历史记录是开发者不可访问的，<strong>my-router-history</strong>提供了一个虚拟历史记录的功能，用于代替history的历史记录。开发者可以访问虚拟历史记录，并动态的删除、增加用户的访问记录。</p>
    
    <h3>禁止用户修改URL</h3>
    <p>在浏览器中，用户可以修改URL，<strong>my-router-history</strong>可以屏蔽这一行为，当用户修改URL后，会用当前页面的URL覆盖掉用户修改的URL。</p>
    <p>虽然<strong>my-router-history</strong>可以屏蔽用户修改URL，但是<strong>my-router-history却不建议开发者开启这项功能</strong>，因为我们毕竟是在浏览器中，禁止修改URL，会降低用户的使用体验，这也违背了<strong>my-router-history</strong>设计的初衷。</p>

    <h2>原理</h2>
    <p><strong>my-router-history</strong>实现原理是返回键劫持，当用户打开页面时候，my-router-history会动态插入一个返回键劫持页面，用于监听用户的返回动作。同时使用hashchange事件监听url的hash改变。无论用户前进、后退都会先返回到返回页面，然后再由返回页面进行前进、后台、替换的行为。</p>

    <h3>目标是提升用户体验</h3>
    <p>目前返回键劫持主要用于在页面中嵌入广告、提升搜索排名等不法行为，而<strong>my-router</strong>致力于提升用户体验。参考IOS系统，系统仅提供一个Home键，导航交给App的开发者自己设计。基于同样的出发点，<strong>my-router-history</strong>设计目的是希望能够减少用户导航的“错误选项”，引导用户遵循WebApp开发者设计的导航。希望WebApp开发者能够正确的使用<strong>my-router-history</strong>的功能，目标是<strong>提升用户体验</strong>，而不是其他。</p>

    <p>基于<strong>返回键劫持</strong>的现状，Chrome浏览器已经着手准备未来禁止这一行为，<strong>my-router-history</strong>会持续跟进改进。</p>
</doc>