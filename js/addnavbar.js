const navbar = `<ul class="navbar noselect">
  <li><a href="/">Home</a></li>
  <li><a href="/user" id="hide_user">Profile</a></li>
  <li><a href="/posts" id="hide_posts">Posts</a></li>
  <li><a href="/dms" id="hide_dms">DMs</a></li>
  <li class="right"><a href="/settings" id="hide_settings" class="less_padding"><img src="/images/settings_min.png" width=30 height=30></a></li>
</ul>`

//<li><a href="/search" id="hide_search">Search</a></li>

function addnavbar() {
  document.body.innerHTML = navbar + document.body.innerHTML
}

document.addEventListener("DOMContentLoaded", addnavbar)
