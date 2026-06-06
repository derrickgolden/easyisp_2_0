<!DOCTYPE html>
<html>
<head>
    <title>{{ $organization->name ?? 'Hotspot' }}</title>

    <meta name="viewport" content="width=device-width, initial-scale=1">

    <style>
        body{
            margin:0;
            font-family:Arial,sans-serif;
            background:#f4f4f4;
        }

        .container{
            max-width:500px;
            margin:20px auto;
            background:white;
            padding:20px;
            border-radius:10px;
        }

        .logo{
            text-align:center;
        }

        .logo img{
            max-width:150px;
        }

        .package{
            border:1px solid #ddd;
            padding:15px;
            margin-bottom:10px;
            border-radius:8px;
        }

        button{
            width:100%;
            background:#0d6efd;
            color:white;
            border:none;
            padding:12px;
            border-radius:5px;
            cursor:pointer;
        }

        input{
            width:100%;
            padding:10px;
            margin-top:10px;
            margin-bottom:10px;
            box-sizing:border-box;
        }

        .error-box{
            background:#fef2f2;
            border:1px solid #f87171;
            color:#b91c1c;
            border-radius:6px;
            padding:10px 14px;
            margin-bottom:14px;
        }

        .error-box p{
            margin:4px 0;
            font-size:14px;
        }

        .success-box{
            background:#f0fdf4;
            border:1px solid #22c55e;
            color:#166534;
            border-radius:6px;
            padding:10px 14px;
            margin-bottom:14px;
        }

        .success-box p{
            margin:4px 0;
            font-size:14px;
        }

        .field-error{
            color:#b91c1c;
            font-size:13px;
            margin-top:-6px;
            margin-bottom:6px;
            display:block;
        }
    </style>
</head>
<body>

@yield('content')

</body>
</html>