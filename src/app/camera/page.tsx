import { redirect } from 'next/navigation'

/** Camera is now on the home page (Upload or take photo). Redirect old /camera links. */
export default function CameraPage() {
  redirect('/')
}
