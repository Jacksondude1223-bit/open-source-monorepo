export default function parseCookies(cookieString: string): {
  [key: string]: string;
} {
  if (cookieString === '') return {};

  const pairs = cookieString.split(';');
  const splittedPairs = pairs.map((cookie) => cookie.split('='));
  const cookieObj = splittedPairs.reduce(function (obj, cookie) {
    //@ts-expect-error this is working
    obj[decodeURIComponent(cookie[0].trim())] = decodeURIComponent(
      //@ts-expect-error it'll buff
      cookie[1].trim(),
    );
    return obj;
  }, {});

  return cookieObj;
}
