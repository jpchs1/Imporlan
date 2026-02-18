<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
?><!DOCTYPE html>
<html><head><meta charset="UTF-8">
<script>var t=localStorage.getItem("imporlan_token");var p=window.location.pathname.indexOf("/test/")!==-1;var base=p?"/panel-test/":"/panel/";window.location.replace(t?base+"?publicar=1#marketplace":base+"#/register");</script>
</head><body></body></html>
