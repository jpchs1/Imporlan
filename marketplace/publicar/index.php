<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
?><!DOCTYPE html>
<html><head><meta charset="UTF-8">
<script>var t=localStorage.getItem("imporlan_token");window.location.replace(t?"/panel/?publicar=1#marketplace":"/panel/#/register");</script>
</head><body></body></html>
