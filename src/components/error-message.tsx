import { Box, Text } from "ink"

export function ErrorMessage({ message }: { message: string }) {
  return (
    <Box marginBottom={1}>
      <Text color="red">Error: {message}</Text>
    </Box>
  )
}
