const navbar = `<ul class="navbar noselect">
  <li><a href="/">Home</a></li>
  <li><a href="/user" id="hide_user">Profile</a></li>
  <li><a href="/posts" id="hide_posts">Posts</a></li>
  <li><a href="/search" id="hide_search">Search</a></li>
  <li class="right"><a href="/settings" id="hide_settings"><img src="/images/settings.png" width=25 height=25></a></li>
</ul>`

function addnavbar() {
  document.body.innerHTML = navbar + document.body.innerHTML
}

document.addEventListener("DOMContentLoaded", addnavbar)
