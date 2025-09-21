class ScheduleSlot:
    def __init__(self, day_of_week, start_time, end_time):
        self.day_of_week = day_of_week
        self.start_time = start_time
        self.end_time = end_time

    def to_dict(self):
        """Converte o objeto para um dicionário."""
        return {
            'day_of_week': self.day_of_week,
            'start_time': self.start_time,
            'end_time': self.end_time
        }

    @staticmethod
    def from_dict(source):
        """Cria um objeto a partir de um dicionário."""
        return ScheduleSlot(
            day_of_week=source.get('day_of_week'),
            start_time=source.get('start_time'),
            end_time=source.get('end_time')
        )